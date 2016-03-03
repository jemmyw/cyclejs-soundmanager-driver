/* eslint quotes: 0, func-names: 0, max-nested-callbacks: 0 */
/*global describe, it, beforeEach */
import expect from 'unexpected'
import {Observable, Subject} from 'rx'
import {makeAudioDriver} from '../src'

function matches(obj, match) {
  return Object.keys(match).every(key => obj[key] === match[key])
}

expect.addAssertion('<array> to [not] have item satisfying <any>',
function(ex, subject, spec) {
  const anyMatches = subject.some(item => matches(item, spec))

  if (anyMatches && ex.flags.not) {
    expect.fail('an item in {0} satisfied {1}', subject, spec)
  } else if (!anyMatches && !ex.flags.not) {
    expect.fail('no items in {0} satisfied {1}', subject, spec)
  }
})

describe('soundmanager driver', function() {
  let audioDriver

  beforeEach(function() {
    audioDriver = makeAudioDriver()
  })

  it('loads an audio file when it receives the first command', function(done) {
    const audio$ = audioDriver(
      Observable.just({src: '/test/test.mp3'}))

    audio$.subscribe(function(audio) {
      expect(audio, 'to satisfy', {
        src: '/test/test.mp3',
        event: 'load',
        muted: false,
        playing: false,
        paused: false,
      })

      // Different browsers report differing durations!
      expect(audio.duration, 'to be greater than', 1140)

      expect(audio, 'to not have key', 'error')
      expect(audio, 'to have key', 'id')

      done()
    })
  })

  it('plays audio when it receives the play command', function(done) {
    const cmds$ = new Subject()
    const audio$ = audioDriver(cmds$).share()

    audio$.filter(evt => evt.event === 'load')
      .subscribe(evt => cmds$.onNext({action: 'play', id: evt.id}))

    audio$.buffer(audio$.filter(evt => evt.event === 'finish'))
      .subscribe(events => {
        expect(events.map(evt => evt.event), 'to contain', 'load')
        expect(events.map(evt => evt.event), 'to contain', 'play')
        expect(events.map(evt => evt.event), 'to contain', 'playing')
        expect(events.map(evt => evt.event), 'to contain', 'finish')

        expect(events.slice(-1)[0], 'to satisfy', {
          event: 'finish',
          playing: false,
          paused: false,
        })
        done()
      })

    cmds$.onNext({src: '/test/test.mp3'})
  })

  it('can pause and resume the audio', function(done) {
    const cmds$ = new Subject()
    const audio$ = audioDriver(cmds$).share()

    audio$.first(evt => evt.event === 'load')
      .subscribe(evt => cmds$.onNext({action: 'play', id: evt.id}))

    audio$.first(evt => evt.event === 'playing')
      .subscribe(evt => cmds$.onNext({action: 'pause', id: evt.id}))

    audio$.first(evt => evt.event === 'pause')
      .subscribe(evt => {
        expect(evt, 'to satisfy', {paused: true, playing: false})
        cmds$.onNext({action: 'play', id: evt.id})
      })

    audio$.buffer(audio$.filter(evt => evt.event === 'finish'))
      .subscribe(events => {
        expect(events.map(evt => evt.event), 'to contain', 'pause')
        expect(events.map(evt => evt.event), 'to contain', 'playing')

        done()
      })

    cmds$.onNext({src: '/test/test.mp3'})
  })

  it('can stop the audio', function(done) {
    const cmds$ = new Subject()
    const audio$ = audioDriver(cmds$).share()

    audio$.first(evt => evt.event === 'load')
      .subscribe(evt => {
        cmds$.onNext({action: 'play', id: evt.id})
        setTimeout(() => cmds$.onNext({action: 'stop', id: evt.id}), 200)
      })

    audio$.filter(evt => evt.event === 'playing')
      .skip(2).first()
      .subscribe(evt => cmds$.onNext({action: 'stop', id: evt.id}))

    audio$.buffer(audio$.filter(evt => evt.event === 'stop'))
      .subscribe(events => {
        expect(events.slice(-1)[0], 'to satisfy', {
          event: 'stop',
          playing: false,
          paused: false,
        })
        done()
      })

    cmds$.onNext({src: '/test/test.mp3'})
  })

  it('can load multiple files and will only play one at a time',
  function(done) {
    const cmds$ = new Subject()
    const audio$ = audioDriver(cmds$).share()

    Observable.zip(
      audio$.first(evt => evt.event === 'load' && evt.src === '/test/test.mp3'),
      audio$.first(evt => evt.event === 'load' && evt.src === '/test/test2.mp3')
    )
    .subscribe(([evt1, evt2]) => {
      cmds$.onNext({action: 'play', id: evt1.id})
      setTimeout(() =>
        cmds$.onNext({action: 'play', id: evt2.id}), 200)
    })

    audio$.buffer(audio$.filter(evt =>
      evt.event === 'finish' && evt.src === '/test/test2.mp3'))
      .subscribe(events => {
        expect(events, 'to have item satisfying', {
          event: 'load', src: '/test/test.mp3'})
        expect(events, 'to have item satisfying', {
          event: 'play', src: '/test/test.mp3'})
        expect(events, 'to have item satisfying', {
          event: 'pause', src: '/test/test.mp3'})
        expect(events, 'to not have item satisfying', {
          event: 'finish', src: '/test/test.mp3'})

        expect(events, 'to have item satisfying', {
          event: 'load', src: '/test/test2.mp3'})
        expect(events, 'to have item satisfying', {
          event: 'play', src: '/test/test2.mp3'})
        expect(events, 'to have item satisfying', {
          event: 'finish', src: '/test/test2.mp3'})

        done()
      })

    cmds$.onNext({src: '/test/test.mp3'})
    cmds$.onNext({src: '/test/test2.mp3'})
  })
})
