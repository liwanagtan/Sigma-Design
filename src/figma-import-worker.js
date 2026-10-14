import { importFigmaBytes } from './figma-import.js';
import { encodeFigmaResult, figmaImportError, FIG_TRANSFER_VERSION } from './figma-import-transfer.js';
self.onmessage = async event => {
  try {
    // An already open tab may still have the old decoder in its module cache.
    // Detect that before parsing a large file, rather than returning an opaque
    // "Invalid Figma import response" after all the expensive work.
    if(event.data.protocol!==FIG_TRANSFER_VERSION) throw new Error('The Figma importer was updated. Refresh Sigma before importing this file again.');
    // File/Blob cloning shares its backing storage. Reading here keeps the 100 MB
    // input buffer out of the UI thread, and transferred result buffers are zero-copy.
    const bytes=await event.data.file.arrayBuffer();
    const result=importFigmaBytes(new Uint8Array(bytes), {name:event.data.name});
    const chunks=encodeFigmaResult(result);
    self.postMessage({chunks},chunks);
  } catch(error) { self.postMessage({error:figmaImportError(error)}); }
};
