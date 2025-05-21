# FIXME

- spider is no longer facing the player when he is aggro state and is following the player
- spider's HUD is not visible and it's no longer possible to attack the spider (or it's not obvious how to do it), also cross is not turning into red (enemy) mode
- same problem with closed chess, crosshair is not changing when we look at it, probably something with raycast
- stamina decreases when shift is pressed even without actual running

# Refactor

- Simplify code whenever possible - a lot of places in the code assume that it's ok if asset is failed to load (we just log warnings), because of that we have to deal with `T | null` or `T | undefined`, have more `if`s and `?` that we actually need. The actual logic is this - all assets MUST be successfully loaded OR the game MUST CRASH. Also update the .cursorrules coding section with this

# Optimize

- Destroy day skybox (not just hide) during the night and vice versa

# TODO

- sand texture
- day skybox
- do not destroy spider's body after his dead, instead apply ragdoll to it
- double jump
- jerks
- gun
- use spider's jump animaion
- add glowing to chest/spider
- add steps sound
- experiment with the camera (try to make it a BIT smooth)