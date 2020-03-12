# AudioSwap
Dynamic interface hook to swap audio channels for GeForce Now Android (or other apps using OpenSL ES)

## Motivation
I recently got a JungleCat controller for my Razer phone. Overall it's a nice gadget but its orientation is at odds with the audio channel config of GeForce Now.

To be more specific, since GFNow uses native OpenSL ES library to play audio, its left-right channel config is fixed and won't change when you rotate the phone as a normal Android app would. And it's fixed at the wrong side. The default left channel is at the bottom but the JungleCat left controller is at the top (and can only slide that way). This is especially painful on Razer phone since it has such a nice pair of stereo speaker.

The channel config seems hard-coded in ROM so I decided to swap left and right audio buffers on the fly.

OpenSL is using an object oriented model and all interactions are through some interface, where each interface supports a specific collection of functions. We only need the Enqueue function from SLBufferQueueItf, but these functions don't have a fixed memory address. So I wrote this Frida script to automatically hook all interface functions as they get created, and look for the buffer enqueue method. Once it is found, the script will intercept on it and swap buffers for left and right channels.

## Usage
* Download `frida-inject` from [here](https://github.com/frida/frida/releases) and place the executable inside this directory.
* Run `run.sh` in a rooted Termux environment, then leave it in background.
* Start Geforce Now and play games, the RemoteVideoProcess will be automatically injected.

For 32 bit arm architectures, remember to change word size from 8 to 4 in the js file. (didn't test for it, might also need other changes)

## References
* [Frida JS API](https://frida.re/docs/javascript-api/)
* [OpenSL ES Header](https://www.khronos.org/registry/OpenSL-ES/api/1.1/OpenSLES.h)
* [OpenSL ES Demo Code](https://gist.github.com/hrydgard/3072540)
