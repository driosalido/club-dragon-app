import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import storageConfig from '@/config/storage'

/**
 * POST /api/admin/sync-slots
 *
 * Idempotent — safe to run multiple times.
 * Reads src/config/storage.ts and syncs storage_slots in the DB:
 *   - Creates slots that are in config but missing in DB
 *   - Reactivates slots that exist but are inactive
 *   - Deactivates slots that exist in DB but are no longer in config
 *   - Never deletes slots (preserves historical stored_games)
 */
export async function POST(request: NextRequest) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Admin check
  const { data: callerData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', caller.sub)
    .single()

  if (!callerData?.is_admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { pizzeros, mesasFijasCount } = storageConfig

  // Fetch all existing slots
  const { data: existingSlots } = await supabase
    .from('storage_slots')
    .select('id, label, slot_type, pizzero, is_active')

  const slotByLabel = new Map((existingSlots ?? []).map((s) => [s.label ?? '', s]))

  const created: string[] = []
  const activated: string[] = []
  const deactivated: string[] = []

  // Build the expected set of labels
  const expectedLabels = new Set<string>()

  // Pizzero slots
  for (const { letter, slots } of pizzeros) {
    for (let i = 1; i <= slots; i++) {
      const label = `${letter}-${i}`
      expectedLabels.add(label)
      const existing = slotByLabel.get(label)

      if (!existing) {
        // Compute next global slot_number
        const { data: maxRow } = await supabase
          .from('storage_slots')
          .select('slot_number')
          .order('slot_number', { ascending: false })
          .limit(1)
          .single()

        const nextNumber = (maxRow?.slot_number ?? 0) + 1

        await supabase.from('storage_slots').insert({
          slot_number: nextNumber,
          label,
          pizzero: letter as 'A' | 'B' | 'C',
          slot_type: 'pizzero',
          is_active: true,
        })
        created.push(label)
      } else {
        // Ensure pizzero letter and active state are correct
        const needsUpdate = !existing.is_active || existing.pizzero !== letter
        if (needsUpdate) {
          await supabase
            .from('storage_slots')
            .update({ is_active: true, pizzero: letter as 'A' | 'B' | 'C' })
            .eq('id', existing.id)
          activated.push(label)
        }
      }
    }
  }

  // Mesa fija slots
  for (let i = 1; i <= mesasFijasCount; i++) {
    const label = `Mesa ${i}`
    expectedLabels.add(label)
    const existing = slotByLabel.get(label)

    if (!existing) {
      const { data: maxRow } = await supabase
        .from('storage_slots')
        .select('slot_number')
        .order('slot_number', { ascending: false })
        .limit(1)
        .single()

      const nextNumber = (maxRow?.slot_number ?? 0) + 1

      await supabase.from('storage_slots').insert({
        slot_number: nextNumber,
        label,
        pizzero: null,
        slot_type: 'mesa_fija',
        is_active: true,
      })
      created.push(label)
    } else if (!existing.is_active) {
      await supabase.from('storage_slots').update({ is_active: true }).eq('id', existing.id)
      activated.push(label)
    }
  }

  // Deactivate slots no longer in config
  for (const slot of existingSlots ?? []) {
    const label = slot.label ?? ''
    if (!expectedLabels.has(label) && slot.is_active) {
      await supabase.from('storage_slots').update({ is_active: false }).eq('id', slot.id)
      deactivated.push(label)
    }
  }

  return Response.json({
    ok: true,
    created,
    activated,
    deactivated,
    config: {
      pizzeros: pizzeros.map((p) => `${p.letter} (${p.slots} slots)`),
      mesasFijas: mesasFijasCount,
      lifecycle: storageConfig.lifecycle,
    },
  })
}
