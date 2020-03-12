/*
 * This script does two things:
 * 1. hook all interface calls starting from slCreateEngine
 * 2. inject buffer processing code before enqueue
 *
 * Example use case: fix reversed audio channels on geforce now android
 *
 */

var log = console.log;
var state = {};

Interceptor.attach(Module.getExportByName('libGsAudioWebRTC.so', 'slCreateEngine'), {

  onEnter: function (args) {
    log('slCreateEngine() onenter pEngine: ' + state.pEngine);
    
    if (state.init) {
        return;
    }
    
    var source = [
        'void swapAudioBuffer(short* buffer, int num_samples) {',
        '    short t;',
        '    for (int l = 0, r = 1; r < num_samples; l += 2, r += 2) {',
        '        t = buffer[l];',
        '        buffer[l] = buffer[r];',
        '        buffer[r] = t;',
        '    }',
        '}'
    ].join('\n');
    var cm = new CModule(source);
    state.swapAudioBuffer = new NativeFunction(cm.swapAudioBuffer, 'void', ['pointer', 'int32']);
    
    state.found = 0;
    state.pEngine = ptr(args[0]);
    state.hooked = {}; // key on function address
    state.cnt = {};    // key on function address
    state.itf = {};    // key on interface id
    
    state.hookFuncPtrs = function (p) {
        // p points to a var that points to an array of method functions
        log('try to hook up to 10 function pointers @ ' + p);
        if (p.readU64() == 0) {
            log('null, return');
            return;
        }
        for (var i = 0; i < 10; ++i) {
            var fp = p.readPointer().readPointer().add(i * 8).readPointer();
            log(i + ': ' + fp);
            if (!state.hooked[fp]) {
                Interceptor.attach(fp, {
                    onEnter: (function (i, p, fp) { return function (args) {
                        if (state.found) {
                            return;
                        }
                        
                        state.cnt[fp] += 1;
                        log('onEnter function ' + i + ' from ' + p + ' addr ' + fp + ' cnt ' + state.cnt[fp]);
                        
                        // state is global, so no need to put in closure
                        // getInterface is function index 3
                        // (actually all getInterface function will call this base func)
                        // ptr is ready on return, so save ptr for onLeave
                        if (p == state.pEngine && i == 3) {
                            var iid = args[1];
                            state.itf[iid] = ptr(args[2]);
                            log('getInterface ' + iid + ' ' + state.itf[iid] + ' ' + state.itf[iid].readU64());
                        }
                        
                        // enqueue is the 0-th function of SLBufferQueueItf
                        // change buffer here before sending to play
                        if (i == 0 && state.cnt[fp] > 100) {
                            log('found enqueue function, disable all other hooks')
                            state.found = 1;
                            Interceptor.attach(fp, {onEnter: function (args) {
                                var pbuffer = ptr(args[1]);
                                var nbytes = args[2];
                                // n_samples = n_bytes / 2 for S16 samples
                                state.swapAudioBuffer(pbuffer, nbytes / 2);
                            }});
                        }
                    }})(i, p, fp),
                    
                    onLeave: (function (i, p, fp) { return function (retval) {
                        if (state.found) {
                            return;
                        }
                        
                        log('onLeave function ' + i + ' from ' + p + ' addr ' + fp);
                        
                        // hook interface
                        if (p == state.pEngine && i == 3) {
                            log('onLeave getInterface, check for itf to hook');
                            for (var iid in state.itf) {
                                var pp = state.itf[iid];
                                if (pp && !state.hooked[pp]) {
                                    log('hook ' + pp)
                                    state.hookFuncPtrs(pp);
                                }
                            }
                        }
                    }})(i, p, fp),
                })
                state.hooked[fp] = 1;
                state.cnt[fp] = 0;
                //log('hooked');
            } else {
                //log('already hooked');
            }
        }
    }
    
    state.init = 1;
    log('state vars & funcs initialized')
  },

  onLeave: function (retval) {
    log('slCreateEngine() onleave retval ' + retval + ' state.pEngine: ' + state.pEngine);
    state.hookFuncPtrs(state.pEngine);
  }
  
});
