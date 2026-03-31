/**
 * Storage configuration — source of truth for physical layout and lifecycle thresholds.
 *
 * To add a new pizzero: add an entry to PIZZEROS.
 * To add/remove mesas fijas: change MESAS_FIJAS_COUNT.
 * After changing this file, run POST /api/admin/sync-slots (admin only) to apply changes to the DB.
 *
 * Lifecycle thresholds: days since last session before status changes.
 * After changing thresholds, also run the SQL in migration 011 to update the PostgreSQL function.
 */

export interface PizzeroConfig {
  /** Single uppercase letter identifying the pizzero (A, B, C, ...) */
  letter: string
  /** Number of slots in this pizzero */
  slots: number
  /** Optional display label (defaults to "Pizzero {letter}") */
  label?: string
}

export interface StorageLifecycle {
  /** Days since last session before status becomes 'warning' */
  warningDays: number
  /** Days since last session before status becomes 'critical' */
  criticalDays: number
  /** Days since last session before status becomes 'expired' */
  expiredDays: number
}

export interface StorageConfig {
  pizzeros: PizzeroConfig[]
  mesasFijasCount: number
  lifecycle: StorageLifecycle
}

const storageConfig: StorageConfig = {
  pizzeros: [
    { letter: 'A', slots: 10 },
    { letter: 'B', slots: 10 },
    { letter: 'C', slots: 10 },
  ],

  mesasFijasCount: 4,

  lifecycle: {
    warningDays: 23,
    criticalDays: 28,
    expiredDays: 30,
  },
}

export default storageConfig
