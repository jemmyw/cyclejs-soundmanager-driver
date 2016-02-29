
# `cyclejs-soundmanager-driver` object API

- [`makeAudioDriver`](#makeAudioDriver)
- [`audioDriver`](#audioDriver)

## SoundManager2 Driver

This is an audio driver for Cycle.js. It uses SoundManager2 to play audio.
It takes an Observable of sound commands as input and returns an Observable
of sound events.

### Example usage

```
const loadAudio$ = Observable.of({src: url_to_audio})
const audioId$ = sources.audio
  .filter(audio => audio.src === url_to_audio).pluck('id')
const playAudio$ = audioId$.map(id => ({id: id, action: 'play'}))

return {
  audio: Observable.merge(
    loadAudio$,
    playAudio$
  )
}
```

- - -

### <a id="makeAudioDriver"></a> `makeAudioDriver()`

A factory for the audio driver.

#### Return:

*(audioDriver)* the audio driver function. The function expects an Observable of command objects as input, and outputs an Observable of sound
event objects.

- - -

### <a id="audioDriver"></a> `audioDriver(audio$)`

The audio driver function.

**Commands** To use the driver the first sound command should load an audio
file and be in the form ```{src: 'url_to_file.mp3'}```.

- Load: {src: url_to_file}
- Play: {id: id, action: 'play'}
- Pause: {id: id, action: 'pause'}
- Stop: {id: id, action: 'stop'}

**Events**

```
{
  id: 'sound0',
  sound: {SoundObject},
  event: 'load|play|pause|stop|playing|finish|update',
  position: 1234, // ms of position
  duration: 2345, // ms of duration
  muted: false,
  volume: 50, // 0 - 100
  paused: false,
  playing: true,
  src: url
}
```

#### Arguments:

- `audio$ :: Observable` - An observable of audio command objects.

#### Return:

*(Observable)* - An observable of audio event objects.

- - -

