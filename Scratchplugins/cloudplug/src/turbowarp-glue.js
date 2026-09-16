// --- TurboWarp glue: register the core as a custom extension ---
(function (Scratch) {
  'use strict';
  const server = (() => { try { const s = document.currentScript && document.currentScript.src; if (s) return new URL(s).origin; } catch {} return '__SERVER__'; })();
  const runtime = Scratch.vm && Scratch.vm.runtime;
  const ext = new CloudPlugBlocks({
    server, runtime,
    getProject: () => { try { const m = location.href.match(/(\d{4,})/); return m ? m[1] : 'turbowarp'; } catch { return 'turbowarp'; } },
    getUser: () => { try { return (runtime && runtime.ioDevices.userData._username) || 'player'; } catch { return 'player'; } },
  });
  Scratch.extensions.register(ext);
})(Scratch);
