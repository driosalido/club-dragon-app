import { describe, it, expect } from 'vitest'
import { parseBggXml } from '@/lib/bgg'

const BGG_FIXTURE = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse" pubdate="">
  <item type="boardgame" id="174430">
    <thumbnail>https://cf.geekdo-images.com/thumb.jpg</thumbnail>
    <name type="primary" sortindex="1" value="Gloomhaven"/>
    <name type="alternate" sortindex="1" value="幽港迷城"/>
    <description>Long description here</description>
    <minplayers value="1"/>
    <maxplayers value="4"/>
    <playingtime value="120"/>
    <link type="boardgamecategory" id="1010" value="Fantasy"/>
    <link type="boardgamecategory" id="1046" value="Fighting"/>
  </item>
</items>`

const BGG_WARGAME_FIXTURE = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<items>
  <item type="boardgame" id="124361">
    <thumbnail>https://example.com/thumb.jpg</thumbnail>
    <name type="primary" sortindex="1" value="Twilight Struggle"/>
    <minplayers value="2"/>
    <maxplayers value="2"/>
    <playingtime value="180"/>
    <link type="boardgamecategory" id="1019" value="Wargame"/>
    <link type="boardgamecategory" id="1021" value="Economic"/>
  </item>
</items>`

describe('parseBggXml', () => {
  it('parses a valid BGG XML response', () => {
    const result = parseBggXml(BGG_FIXTURE, 174430)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Gloomhaven')
    expect(result?.bgg_id).toBe(174430)
    expect(result?.min_players).toBe(1)
    expect(result?.max_players).toBe(4)
    expect(result?.avg_duration_min).toBe(120)
    expect(result?.thumbnail_url).toBe('https://cf.geekdo-images.com/thumb.jpg')
  })

  it('returns null when no primary name is found', () => {
    const xml = `<items><item type="boardgame" id="999"><name type="alternate" value="foo"/></item></items>`
    expect(parseBggXml(xml, 999)).toBeNull()
  })

  it('infers wargame_tablero category from boardgamecategory', () => {
    const result = parseBggXml(BGG_WARGAME_FIXTURE, 124361)
    expect(result?.category).toBe('wargame_tablero')
  })

  it('handles XML entities in name', () => {
    const xml = `<items><item type="boardgame" id="1"><name type="primary" value="A &amp; B"/><minplayers value="2"/><maxplayers value="4"/><playingtime value="60"/></item></items>`
    const result = parseBggXml(xml, 1)
    expect(result?.name).toBe('A & B')
  })
})
