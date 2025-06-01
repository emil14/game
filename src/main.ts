import { CreateAudioEngineAsync } from "@babylonjs/core";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";

import { UI_ELEMENT_IDS } from "./config";
import { SoundManager } from "./managers/sound_manager";
import { Game } from "./game";
import { listenForConsoleCommands } from "./console_manager";

const canvas = document.getElementById(UI_ELEMENT_IDS.RENDER_CANVAS);
const audioEngine = await CreateAudioEngineAsync();
const soundManager = new SoundManager(audioEngine);
const game = new Game(canvas as HTMLCanvasElement, soundManager);

listenForConsoleCommands(game);

await game.start();
