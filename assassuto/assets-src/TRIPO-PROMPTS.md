# Tripo prompts (generated)

Generated from `assets-src/manifest.json` by `npm run assets:prompts`. Do not edit by hand.

Manual workflow in Tripo Studio: generate the model with the prompt and negative prompt below, rig it with the listed rig type,
add the listed preset animations, export **GLB** and save it as `assets-src/incoming/<id>/rigged.glb` (or `base.glb` when there is no rig).
Then run `npm run assets`.

**Negative prompt (all assets):** photorealistic, realistic skin pores, low poly, blocky, voxel, multiple characters, base, pedestal, ground plane, text, watermark, logo, blurry

## Phase 1

### `player_feminine` (character)

```
young woman adventurer, slim athletic build, long dark hair, light travel coat with short cape over a fitted tunic, leather belt with small pouches, fingerless gloves, knee-high boots, no weapon in hands, neutral colours with off-white and deep navy. original character design, stylized anime fantasy action RPG art style, expressive face with large eyes, hand-painted cel-shaded textures, clean readable silhouette, full body, standing in A-pose with arms slightly away from the body, facing forward, neutral expression, game-ready
```

- Face limit: 40000; target height in game: 1.68 m
- Rig: biped (model v1.0-20240301, spec tripo)
- Animations: idle = `preset:biped:idle`, walk = `preset:biped:walk`, run = `preset:biped:run`, jump = `preset:biped:jump`, fall = `preset:biped:fall`, slash = `preset:biped:slash`, chop = `preset:biped:chop`, box_01 = `preset:biped:box_01`, box_02 = `preset:biped:box_02`, front_kick_01 = `preset:biped:front_kick_01`, cast_a_spell = `preset:biped:cast_a_spell`, dive = `preset:biped:dive`, flip = `preset:biped:flip`, hurt = `preset:biped:hurt`, hit_to_body_01 = `preset:biped:hit_to_body_01`, hit_to_head = `preset:biped:hit_to_head`, fall_down = `preset:biped:defeat_02`, hug = `preset:biped:hug`, look_around = `preset:biped:look_around`, victory = `preset:biped:victory_celebration`

## Phase 2

### `player_masculine` (character)

```
young man adventurer, athletic build, short dark brown hair, light travel coat with short cape over a fitted tunic, leather belt with small pouches, fingerless gloves, knee-high boots, no weapon in hands, neutral colours with off-white and deep navy. original character design, stylized anime fantasy action RPG art style, expressive face with large eyes, hand-painted cel-shaded textures, clean readable silhouette, full body, standing in A-pose with arms slightly away from the body, facing forward, neutral expression, game-ready
```

- Face limit: 40000; target height in game: 1.78 m
- Rig: biped (model v1.0-20240301, spec tripo)
- Animations: idle = `preset:biped:idle`, walk = `preset:biped:walk`, run = `preset:biped:run`, jump = `preset:biped:jump`, fall = `preset:biped:fall`, slash = `preset:biped:slash`, chop = `preset:biped:chop`, box_01 = `preset:biped:box_01`, box_02 = `preset:biped:box_02`, front_kick_01 = `preset:biped:front_kick_01`, cast_a_spell = `preset:biped:cast_a_spell`, dive = `preset:biped:dive`, flip = `preset:biped:flip`, hurt = `preset:biped:hurt`, hit_to_body_01 = `preset:biped:hit_to_body_01`, hit_to_head = `preset:biped:hit_to_head`, fall_down = `preset:biped:defeat_02`, hug = `preset:biped:hug`, look_around = `preset:biped:look_around`, victory = `preset:biped:victory_celebration`

## Phase 3

### `enemy_raider` (character)

```
masked bandit raider, lean build, patched leather armour with rough cloth hood, half mask, bracers, worn boots, muted brown and rust colours, menacing stance. original character design, stylized anime fantasy action RPG art style, expressive face with large eyes, hand-painted cel-shaded textures, clean readable silhouette, full body, standing in A-pose with arms slightly away from the body, facing forward, neutral expression, game-ready
```

- Face limit: 25000; target height in game: 1.75 m
- Rig: biped (model v1.0-20240301, spec tripo)
- Animations: idle = `preset:biped:idle`, walk = `preset:biped:walk`, run = `preset:biped:run`, slash = `preset:biped:slash`, chop = `preset:biped:chop`, hurt = `preset:biped:hurt`, hit_to_body_01 = `preset:biped:hit_to_body_01`, fall_down = `preset:biped:defeat_02`, dive = `preset:biped:dive`, angry = `preset:biped:angry_01`

### `weapon_sword` (weapon)

```
elegant one-handed fantasy sword, slim slightly curved blade, ornate silver guard with a small inset gem, wrapped leather grip, lying straight vertical. stylized anime fantasy action RPG prop, hand-painted cel-shaded textures, clean shapes, single object, game-ready
```

- Face limit: 6000; target height in game: 0.95 m

### `weapon_spear` (weapon)

```
fantasy spear, long wooden shaft with metal bands, leaf-shaped steel spearhead, small cloth ribbon under the head, straight vertical. stylized anime fantasy action RPG prop, hand-painted cel-shaded textures, clean shapes, single object, game-ready
```

- Face limit: 6000; target height in game: 2 m

## Phase 4

### `enemy_archer` (character)

```
hooded raider archer, slim build, light leather armour, quiver on back, long scarf, muted green and brown colours, no bow in hands. original character design, stylized anime fantasy action RPG art style, expressive face with large eyes, hand-painted cel-shaded textures, clean readable silhouette, full body, standing in A-pose with arms slightly away from the body, facing forward, neutral expression, game-ready
```

- Face limit: 25000; target height in game: 1.72 m
- Rig: biped (model v1.0-20240301, spec tripo)
- Animations: idle = `preset:biped:idle`, walk = `preset:biped:walk`, run = `preset:biped:run`, shoot = `preset:biped:shoot`, hurt = `preset:biped:hurt`, fall_down = `preset:biped:defeat_02`

### `enemy_brute` (character)

```
huge armoured brute, very broad heavy build, thick plate pauldrons and spiked gauntlets, horned iron helmet, dark iron and deep red colours. original character design, stylized anime fantasy action RPG art style, expressive face with large eyes, hand-painted cel-shaded textures, clean readable silhouette, full body, standing in A-pose with arms slightly away from the body, facing forward, neutral expression, game-ready
```

- Face limit: 30000; target height in game: 2.35 m
- Rig: biped (model v1.0-20240301, spec tripo)
- Animations: idle = `preset:biped:idle`, walk = `preset:biped:walk`, chop = `preset:biped:chop`, lift_heavy = `preset:biped:lift_heavy`, hurt = `preset:biped:hurt`, fall_down = `preset:biped:defeat_02`, angry = `preset:biped:angry_02`

### `prop_shrine` (prop)

```
ancient elemental shrine, circular stone platform with six carved standing stones around a floating crystal pedestal, weathered stone with soft moss. stylized anime fantasy action RPG prop, hand-painted cel-shaded textures, clean shapes, single object, game-ready
```

- Face limit: 30000; target height in game: 4.5 m

### `prop_fire_brazier` (prop)

```
volcanic basalt brazier with glowing ember cracks, carved flame motifs. stylized anime fantasy action RPG prop, hand-painted cel-shaded textures, clean shapes, single object, game-ready
```

- Face limit: 8000; target height in game: 1.4 m

### `prop_water_lantern` (prop)

```
frosted stone lantern with icy blue glass and wave carvings, snow on top. stylized anime fantasy action RPG prop, hand-painted cel-shaded textures, clean shapes, single object, game-ready
```

- Face limit: 8000; target height in game: 1.6 m

### `prop_earth_monolith` (prop)

```
mossy carved earth monolith with ancient spiral runes, roots wrapped around the base. stylized anime fantasy action RPG prop, hand-painted cel-shaded textures, clean shapes, single object, game-ready
```

- Face limit: 10000; target height in game: 3.5 m

### `prop_air_windchime` (prop)

```
tall wooden wind chime post with hanging crystal chimes and long fluttering ribbons. stylized anime fantasy action RPG prop, hand-painted cel-shaded textures, clean shapes, single object, game-ready
```

- Face limit: 8000; target height in game: 3 m

## Phase 5

### `echo_human` (character)

```
gentle guardian spirit in human form, flowing long robe and soft shawl, calm kind face, simple elegant clothing in pale white and silver, slightly translucent ethereal look. original character design, stylized anime fantasy action RPG art style, expressive face with large eyes, hand-painted cel-shaded textures, clean readable silhouette, full body, standing in A-pose with arms slightly away from the body, facing forward, neutral expression, game-ready
```

- Face limit: 30000; target height in game: 1.75 m
- Rig: biped (model v1.0-20240301, spec tripo)
- Animations: idle = `preset:biped:idle`, walk = `preset:biped:walk`, run = `preset:biped:run`, hug = `preset:biped:hug`, cast_a_spell = `preset:biped:cast_a_spell`, greet = `preset:biped:greet_01`

### `echo_wolf` (creature)

```
guardian spirit wolf, large graceful wolf with long flowing mane and tail, pale silver fur with soft glowing markings, kind eyes. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 25000; target height in game: 1.1 m
- Rig: quadruped (model v2.5-20260210)
- Animations: walk = `preset:quadruped:walk`

### `echo_bird` (creature)

```
guardian spirit bird, large elegant crane-like bird with long flowing tail feathers, pale white and silver plumage with soft glowing markings, wings folded. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 20000; target height in game: 1.3 m
- Rig: avian (model v2.5-20260210)

## Phase 6

### `creature_emberfox` (creature)

```
small fire fox creature with three fluffy tails tipped with ember-like glow, orange and cream fur, curious big eyes. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 15000; target height in game: 0.6 m
- Rig: quadruped (model v2.5-20260210)
- Animations: walk = `preset:quadruped:walk`

### `creature_tidecrane` (creature)

```
graceful water heron creature with flowing fin-like feathers, deep blue and teal plumage with white accents, long legs, timid posture. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 15000; target height in game: 1.2 m
- Rig: avian (model v2.5-20260210)

### `creature_mossback` (creature)

```
gentle earth tortoise-like creature with a mossy rock shell, small ferns and flowers growing on the shell, sturdy legs, calm protective look. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 18000; target height in game: 0.9 m
- Rig: quadruped (model v2.5-20260210)
- Animations: walk = `preset:quadruped:walk`

### `creature_zephyrhare` (creature)

```
light air hare creature with long ribbon-like ears and wispy tail, pale mint and white fur, playful pose. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 15000; target height in game: 0.5 m
- Rig: quadruped (model v2.5-20260210)
- Animations: walk = `preset:quadruped:walk`

### `mount_dunemane` (mount)

```
large rideable wolf-like beast mount with a thick sandy mane, muscular legs, simple leather saddle and reins, tan and dark brown fur. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 30000; target height in game: 1.8 m
- Rig: quadruped (model v2.5-20260210)
- Animations: walk = `preset:quadruped:walk`

### `mount_skywing` (mount)

```
large rideable griffin-like flying mount with feathered head and wings, lion-like body, saddle on its back, white and sky-blue feathers with gold accents, wings folded. original fantasy creature design, stylized anime fantasy action RPG art style, hand-painted cel-shaded textures, memorable silhouette, full body, standing neutral pose, facing forward, game-ready
```

- Face limit: 35000; target height in game: 2.2 m
- Rig: quadruped (model v2.5-20260210)
- Animations: walk = `preset:quadruped:walk`
