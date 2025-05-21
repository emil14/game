# FIXME

- spider is no longer facing the player when he is aggro state and is following the player

# Refactor

- Simplify code whenever possible - a lot of places in the code assume that it's ok if asset is failed to load (we just log warnings), because of that we have to deal with `T | null` or `T | undefined`, have more `if`s and `?` that we actually need. The actual logic is this - all assets MUST be successfully loaded OR the game MUST CRASH. Also update the .cursorrules coding section with this

# TODO

- when player is sitting, his stamina should regen x1.5 faster
- stricter ts config and/or linter (with plugins e.g. BabylonJS?)
- day skybox
- do not destroy spider's body after his dead, instead apply ragdoll to it
- make jumps more "real"
- double jump
- jerks
- gun
- use spider's jump animaion
- add glowing to chest/spider
- add steps sound
- experiment with the camera (try to make it a BIT smooth)
