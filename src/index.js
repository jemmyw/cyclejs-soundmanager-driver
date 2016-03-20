import {soundManager} from 'soundmanager2'
import {Observable} from 'rx'

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

const sounds = {}

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
    src: sound.url,
    scope: sound.scope,
  })
}

function soundError(sound, obs) {
  obs.onNext({
    id: sound.id,
    scope: sound.scope,
    src: sound.url,
    error: true,
  })
}

function createSound(obs, command) {
  if (!command.src) { throw new Error(`Sound src must be set`) }

  const thisSound = soundManager.createSound({
    url: command.src,
    autoPlay: false,
    autoLoad: true,
    onload: () => {
      if (thisSound.readyState === 3) { soundEvent(thisSound, obs, `load`) }
      if (thisSound.readyState === 2) { soundError(thisSound, obs) }
    },
    onfinish: () => soundEvent(thisSound, obs, `finish`),
    onpause: () => soundEvent(thisSound, obs, `pause`),
    onplay: () => soundEvent(thisSound, obs, `play`),
    onresume: () => soundEvent(thisSound, obs, `play`),
    onstop: () => soundEvent(thisSound, obs, `stop`),
    whileplaying: () => soundEvent(thisSound, obs, `playing`),
    onfailure: (err) => soundEvent(thisSound, obs, `failure`, err),
  })

  if (thisSound) {
    thisSound.scope = command.scope
    sounds[thisSound.id] = thisSound
  } else {
    soundError({
      scope: command.scope,
      id: null,
      url: command.src,
    }, obs)
  }
}

function setRelativePosition(sound, relative) {
  const newPosition = sound.position + relative
  sound.setPosition(newPosition)
}

function performCommand(obs, command) {
  const {id, position, relative, progress, action, volume} = command
  const sound = sounds[id]
  if (!sound) { return obs.onError(new Error(`Could not find sound`)) }

  if (position) {
    sound.setPosition(position)
  }

  if (relative) {
    setRelativePosition(sound, relative)
  }

  if (progress) {
    sound.setPosition(sound.duration * progress)
  }

  if (action) {
    if (~[`play`, `resume`].indexOf(action)) {
      soundManager.pauseAll()
    }

    sound[action]()
  }

  if (volume) {
    sound.setVolume(volume)
  }

  soundEvent(sound, obs, `update`)
}

function commandExecutor(audio$, observer) {
  audio$.subscribe(command => {
    if (command.id) {
      performCommand(observer, command)
    } else {
      createSound(observer, command)
    }
  })
}

function isolateSink(sink$, scope) {
  return sink$.map(cmd => ({...cmd, scope: (cmd.scope || []).concat(scope)}))
}

function isolateSource(source$, scope) {
  const isolatedSource$ = source$
    .filter(evt => Array.isArray(evt.scope) && evt.scope.indexOf(scope) !== -1)

  isolatedSource$.isolateSource = isolateSource
  isolatedSource$.isolateSink = isolateSink

  return isolatedSource$
}

function makeAudioDriver(options) {
  soundManager.setupOptions.url = '/node_modules/soundmanager2/swf/'
  Object.keys(options).forEach(key =>
    soundManager.setupOptions[key] = options[key])

  const onready$ = Observable.create(obs => {
    soundManager.setup({
      onready: () => obs.onNext(soundManager),
    })
  })

  return function audioDriver(audio$) {
    const out$ = Observable.create(obs => {
      onready$.subscribe(() => {
        commandExecutor(audio$, obs)
      })
    }).share()

    out$.isolateSource = isolateSource
    out$.isolateSink = isolateSink

    return out$
  }
}

export {makeAudioDriver}
