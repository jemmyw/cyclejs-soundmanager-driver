'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeAudioDriver = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _soundmanager = require('soundmanager2');

var _rx = require('rx');

var _rxAdapter = require('@cycle/rx-adapter');

var _rxAdapter2 = _interopRequireDefault(_rxAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
* ## SoundManager2 Driver
*
* This is an audio driver for Cycle.js. It uses SoundManager2 to play audio.
* It takes an Observable of sound commands as input and returns an Observable
* of sound events.
*
* ### Example usage
*
* ```
* const loadAudio$ = Observable.of({src: url_to_audio})
* const audioId$ = sources.audio
*   .filter(audio => audio.src === url_to_audio).pluck('id')
* const playAudio$ = audioId$.map(id => ({id: id, action: 'play'}))
*
* return {
*   audio: Observable.merge(
*     loadAudio$,
*     playAudio$
*   )
* }
* ```
**/

/**
* A factory for the audio driver.
*
* @return {audioDriver} the audio driver function. The function expects an
* Observable of command objects as input, and outputs an Observable of sound
* event objects.
*
* @function makeAudioDriver
*
**/

/**
* The audio driver function.
*
* **Commands** To use the driver the first sound command should load an audio
* file and be in the form ```{src: 'url_to_file.mp3'}```.
*
* - Load: {src: url_to_file}
* - Play: {id: id, action: 'play'}
* - Pause: {id: id, action: 'pause'}
* - Stop: {id: id, action: 'stop'}
*
* **Events**
*
* ```
* {
*   id: 'sound0',
*   sound: {SoundObject},
*   event: 'load|play|pause|stop|playing|finish|update',
*   position: 1234, // ms of position
*   duration: 2345, // ms of duration
*   muted: false,
*   volume: 50, // 0 - 100
*   paused: false,
*   playing: true,
*   src: url
* }
* ```
* @param {Observable} audio$ - An observable of audio command objects.
* @return {Observable} - An observable of audio event objects.
* @function audioDriver
**/

var sounds = {};

function soundEvent(sound, obs, event) {
  obs.onNext({
    id: sound.id,
    //sound: sound,
    event: event,
    position: sound.position,
    duration: sound.duration,
    muted: sound.muted,
    volume: sound.muted ? 0 : sound.volume,
    paused: sound.paused,
    playing: !sound.paused && sound.playState === 1,
    loaded: sound.readyState === 3,
    src: sound.url,
    scope: sound.scope
  });
}

function soundError(sound, obs) {
  obs.onNext({
    id: sound.id,
    scope: sound.scope,
    src: sound.url,
    error: true
  });
}

function createSound(obs, command) {
  if (!command.src) {
    throw new Error('Sound src must be set');
  }

  var thisSound = _soundmanager.soundManager.createSound({
    url: command.src,
    autoPlay: false,
    autoLoad: true,
    onload: function onload() {
      if (thisSound.readyState === 3) {
        soundEvent(thisSound, obs, 'load');
      }
      if (thisSound.readyState === 2) {
        soundError(thisSound, obs);
      }
    },
    onfinish: function onfinish() {
      return soundEvent(thisSound, obs, 'finish');
    },
    onpause: function onpause() {
      return soundEvent(thisSound, obs, 'pause');
    },
    onplay: function onplay() {
      return soundEvent(thisSound, obs, 'play');
    },
    onresume: function onresume() {
      return soundEvent(thisSound, obs, 'play');
    },
    onstop: function onstop() {
      return soundEvent(thisSound, obs, 'stop');
    },
    whileplaying: function whileplaying() {
      return soundEvent(thisSound, obs, 'playing');
    },
    onfailure: function onfailure(err) {
      return soundEvent(thisSound, obs, 'failure', err);
    }
  });

  if (thisSound) {
    thisSound.scope = command.scope;
    sounds[thisSound.id] = thisSound;
  } else {
    soundError({
      scope: command.scope,
      id: null,
      url: command.src
    }, obs);
  }
}

function setRelativePosition(sound, relative) {
  var newPosition = sound.position + relative;
  sound.setPosition(newPosition);
}

function performCommand(obs, command) {
  var id = command.id;
  var position = command.position;
  var relative = command.relative;
  var progress = command.progress;
  var action = command.action;
  var volume = command.volume;

  var sound = sounds[id];
  if (!sound) {
    return obs.onError(new Error('Could not find sound'));
  }

  if (position) {
    sound.setPosition(position);
  }

  if (relative) {
    setRelativePosition(sound, relative);
  }

  if (progress) {
    sound.setPosition(sound.duration * progress);
  }

  if (action) {
    if (~['play', 'resume'].indexOf(action)) {
      _soundmanager.soundManager.pauseAll();
    }

    sound[action]();
  }

  if (volume) {
    sound.setVolume(volume);
  }

  soundEvent(sound, obs, 'update');
}

function performGlobalCommand(obs, command) {
  _soundmanager.soundManager[command.action]();
}

function commandExecutor(audio$, observer) {
  audio$.subscribe(function (command) {
    if (command.id) {
      performCommand(observer, command);
    } else if (command.action) {
      performGlobalCommand(observer, command);
    } else {
      createSound(observer, command);
    }
  });
}

function isolateSink(sink$, scope) {
  return sink$.map(function (cmd) {
    return _extends({}, cmd, { scope: (cmd.scope || []).concat(scope) });
  });
}

function isolateSource(source$, scope) {
  var isolatedSource$ = source$.filter(function (evt) {
    return Array.isArray(evt.scope) && evt.scope.indexOf(scope) !== -1;
  });

  isolatedSource$.isolateSource = isolateSource;
  isolatedSource$.isolateSink = isolateSink;

  return isolatedSource$;
}

function makeAudioDriver(options) {
  _soundmanager.soundManager.setupOptions.url = '/node_modules/soundmanager2/swf/';
  Object.keys(options).forEach(function (key) {
    return _soundmanager.soundManager.setupOptions[key] = options[key];
  });

  var onready$ = _rx.Observable.create(function (obs) {
    _soundmanager.soundManager.setup({
      onready: function onready() {
        return obs.onNext(_soundmanager.soundManager);
      }
    });
  });

  var audioDriver = function audioDriver(audio$) {
    var out$ = _rx.Observable.create(function (obs) {
      onready$.subscribe(function () {
        commandExecutor(audio$, obs);
      });
    }).share();

    out$.isolateSource = isolateSource;
    out$.isolateSink = isolateSink;

    return out$;
  };

  audioDriver.streamAdapter = _rxAdapter2.default;
  return audioDriver;
}

exports.makeAudioDriver = makeAudioDriver;