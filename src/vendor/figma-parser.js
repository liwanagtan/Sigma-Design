// Vendored MIT code. See figma-parser.NOTICE.txt. Regenerate with npm run build:figma.
// src/parser.ts
import { unzipSync, inflateSync } from "./figma-fflate.js";
import { decodeBinarySchema, compileSchema } from "./figma-kiwi.js";
import { decompress as zstdDecompress } from "./figma-fzstd.js";

// src/utils.ts
function nodeId(node) {
  if (!node?.guid) return null;
  return `${node.guid.sessionID}:${node.guid.localID}`;
}

// src/parser.ts
function parseFigBinary(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const prelude = String.fromCharCode(...data.subarray(0, 8));
  if (!prelude.startsWith("fig-")) {
    throw new Error(`Unknown prelude: ${prelude}`);
  }
  const version = view.getUint32(8, true);
  const chunks = [];
  let off = 12;
  while (off < data.byteLength) {
    if (off + 4 > data.byteLength) {
      throw new Error(
        `Truncated .fig binary: ${data.byteLength - off} byte(s) left at offset ${off}, expected a 4-byte chunk length`
      );
    }
    const len = view.getUint32(off, true);
    off += 4;
    if (off + len > data.byteLength) {
      throw new Error(
        `Truncated .fig binary: chunk ${chunks.length} declares ${len} bytes at offset ${off} but only ${data.byteLength - off} remain`
      );
    }
    chunks.push(data.subarray(off, off + len));
    off += len;
  }
  if (chunks.length < 2) {
    throw new Error("Expected at least 2 chunks in .fig binary");
  }
  const schemaData = inflateSync(chunks[0]);
  const schema = decodeBinarySchema(schemaData);
  const compiled = compileSchema(schema);
  let msgData;
  const c1 = chunks[1];
  if (c1[0] === 40 && c1[1] === 181 && c1[2] === 47 && c1[3] === 253) {
    msgData = zstdDecompress(c1);
  } else {
    msgData = inflateSync(c1);
  }
  const message = compiled.decodeMessage(msgData);
  const nodes = message.nodeChanges;
  const nodeMap = /* @__PURE__ */ new Map();
  const childrenMap = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const id = nodeId(node);
    if (id) nodeMap.set(id, node);
  }
  for (const node of nodes) {
    if (!node.parentIndex?.guid) continue;
    const pid = `${node.parentIndex.guid.sessionID}:${node.parentIndex.guid.localID}`;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(node);
  }
  return {
    header: { prelude: prelude.trim(), version },
    nodes,
    nodeMap,
    childrenMap,
    schema,
    compiledSchema: compiled,
    rawChunks: chunks,
    message,
    images: /* @__PURE__ */ new Map()
  };
}
function parseFig(data) {
  if (data[0] !== 80 || data[1] !== 75) {
    throw new Error("Not a valid .fig file (missing ZIP header)");
  }
  const unzipped = unzipSync(data);
  const canvasKey = Object.keys(unzipped).find((k) => k.endsWith("canvas.fig"));
  if (!canvasKey) {
    throw new Error("No canvas.fig found in .fig archive");
  }
  const doc = parseFigBinary(unzipped[canvasKey]);
  const metaKey = Object.keys(unzipped).find((k) => k.endsWith("meta.json"));
  if (metaKey) {
    try {
      doc.meta = JSON.parse(new TextDecoder().decode(unzipped[metaKey]));
    } catch {
    }
  }
  const thumbKey = Object.keys(unzipped).find((k) => k.endsWith("thumbnail.png"));
  if (thumbKey) {
    doc.thumbnail = unzipped[thumbKey];
  }
  for (const key of Object.keys(unzipped)) {
    if (key.includes("images/") && key !== "images/") {
      const filename = key.split("/").pop();
      doc.images.set(filename, unzipped[key]);
    }
  }
  return doc;
}

// src/encoder.ts
import { deflateSync, zipSync } from "./figma-fflate.js";
import { encodeBinarySchema } from "./figma-kiwi.js";
function encodeFigParts(doc) {
  if (!doc.compiledSchema || !doc.message) {
    throw new Error("FigDocument missing compiledSchema or message \u2014 cannot encode");
  }
  if (!doc.schema) {
    throw new Error("FigDocument missing schema \u2014 cannot encode");
  }
  const messageRaw = new Uint8Array(doc.compiledSchema.encodeMessage(doc.message));
  const schemaRaw = encodeBinarySchema(doc.schema);
  const schemaCompressed = deflateSync(new Uint8Array(schemaRaw));
  const passThrough = doc.rawChunks.slice(2);
  return {
    schemaCompressed,
    messageRaw,
    prelude: doc.header.prelude,
    version: doc.header.version,
    passThrough
  };
}
function assembleCanvasFig(input) {
  const { prelude, version, schemaCompressed, messageCompressed, passThrough = [] } = input;
  const chunks = [schemaCompressed, messageCompressed, ...passThrough];
  const headerSize = 8 + 4;
  const totalSize = chunks.reduce((sz, c) => sz + 4 + c.byteLength, headerSize);
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);
  let off = 0;
  const enc = new TextEncoder();
  const preludeBytes = enc.encode(prelude);
  buf.set(preludeBytes, 0);
  for (let i = preludeBytes.length; i < 8; i++) {
    buf[i] = 32;
  }
  off = 8;
  view.setUint32(off, version, true);
  off += 4;
  for (const chunk of chunks) {
    view.setUint32(off, chunk.byteLength, true);
    off += 4;
    buf.set(chunk, off);
    off += chunk.byteLength;
  }
  return buf;
}
function createFigZip(input) {
  const opts = {};
  opts["canvas.fig"] = [input.canvasFig, { level: 0 }];
  if (input.meta) {
    opts["meta.json"] = [new TextEncoder().encode(JSON.stringify(input.meta)), { level: 0 }];
  }
  if (input.thumbnail) {
    opts["thumbnail.png"] = [input.thumbnail, { level: 0 }];
  }
  if (input.images) {
    for (const [name, data] of input.images) {
      opts[`images/${name}`] = [data, { level: 0 }];
    }
  }
  return zipSync(opts);
}

// src/convert.ts
function guidToString(guid) {
  return `${guid.sessionID}:${guid.localID}`;
}
function safeDeepClone(val) {
  if (val === null || val === void 0) return val;
  if (val instanceof Uint8Array) {
    return new Uint8Array(val);
  }
  if (Array.isArray(val)) {
    return val.map(safeDeepClone);
  }
  if (typeof val === "object") {
    const copy = {};
    for (const k of Object.keys(val)) {
      copy[k] = safeDeepClone(val[k]);
    }
    return copy;
  }
  return val;
}
function convertDeckToFig(deckDoc, options = {}) {
  const {
    title,
    layout = "row",
    gap = 200,
    wrap = 5
  } = options;
  const activeSlides = deckDoc.nodes.filter((n) => n.type === "SLIDE" && n.phase !== "REMOVED").sort((a, b) => {
    const posA = a.parentIndex?.position ?? "";
    const posB = b.parentIndex?.position ?? "";
    return posA.localeCompare(posB);
  });
  let maxLocalId = 0;
  for (const node of deckDoc.nodes) {
    if (node.guid?.localID > maxLocalId) {
      maxLocalId = node.guid.localID;
    }
  }
  let nextLocalId = maxLocalId + 1;
  const sessionId = 1;
  function generateGuid() {
    return { sessionID: sessionId, localID: nextLocalId++ };
  }
  const documentNode = deckDoc.nodes.find((n) => n.type === "DOCUMENT");
  const docGuid = documentNode?.guid ?? { sessionID: 0, localID: 0 };
  const canvasGuid = generateGuid();
  const canvasName = title || deckDoc.meta?.file_name || "Page 1";
  const newCanvasNode = {
    guid: canvasGuid,
    type: "CANVAS",
    name: canvasName,
    phase: "CREATED",
    parentIndex: {
      guid: docGuid,
      position: "!"
    },
    visible: true
  };
  const outputNodes = [];
  if (documentNode) {
    outputNodes.push(safeDeepClone(documentNode));
  }
  outputNodes.push(newCanvasNode);
  const outputBlobs = [];
  const blobRemap = /* @__PURE__ */ new Map();
  function copyBlob(sourceIdx) {
    if (sourceIdx === void 0 || sourceIdx === null || sourceIdx < 0) return void 0;
    if (!deckDoc.message?.blobs || sourceIdx >= deckDoc.message.blobs.length) return sourceIdx;
    if (blobRemap.has(sourceIdx)) {
      return blobRemap.get(sourceIdx);
    }
    const newIdx = outputBlobs.length;
    outputBlobs.push(safeDeepClone(deckDoc.message.blobs[sourceIdx]));
    blobRemap.set(sourceIdx, newIdx);
    return newIdx;
  }
  const totalSlides = activeSlides.length;
  const paddingWidth = Math.max(2, String(totalSlides).length);
  activeSlides.forEach((slide, index) => {
    const slideId = guidToString(slide.guid);
    const slideSize = slide.size ?? { x: 1920, y: 1080 };
    const width = slideSize.x;
    const height = slideSize.y;
    let x = 0;
    let y = 0;
    if (layout === "grid") {
      const col = index % wrap;
      const row = Math.floor(index / wrap);
      x = col * (width + gap);
      y = row * (height + gap);
    } else {
      x = index * (width + gap);
      y = 0;
    }
    let slideTitle = "";
    const children = deckDoc.childrenMap.get(slideId) || [];
    const instanceNode = children.find((c) => c.type === "INSTANCE");
    if (instanceNode?.symbolData?.symbolID) {
      const symGuidStr = guidToString(instanceNode.symbolData.symbolID);
      const symNode = deckDoc.nodeMap.get(symGuidStr);
      if (symNode) {
        const firstText = findFirstTextNode(deckDoc, symGuidStr);
        if (firstText) {
          const originalTextGuid = firstText.guid;
          const overrides = instanceNode.symbolData?.symbolOverrides || [];
          const ov = overrides.find(
            (o) => o.guidPath?.guids?.length === 1 && o.guidPath.guids[0].sessionID === originalTextGuid.sessionID && o.guidPath.guids[0].localID === originalTextGuid.localID && o.textData?.characters
          );
          slideTitle = ov?.textData?.characters || firstText.textData?.characters || "";
        }
      }
    }
    slideTitle = slideTitle.trim();
    const frameIndexStr = String(index + 1).padStart(paddingWidth, "0");
    const frameName = slideTitle ? `${frameIndexStr} \xB7 ${slideTitle}` : `${frameIndexStr} \xB7 Slide ${frameIndexStr}`;
    const frameGuid = generateGuid();
    const frameNode = {
      guid: frameGuid,
      type: "FRAME",
      name: frameName,
      phase: "CREATED",
      parentIndex: {
        guid: canvasGuid,
        position: String.fromCharCode(33 + index)
      },
      size: { x: width, y: height },
      transform: { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y },
      visible: true,
      opacity: 1,
      frameMaskDisabled: false,
      // Inherit fill paints and geometry from the SLIDE node
      fillPaints: slide.fillPaints ? safeDeepClone(slide.fillPaints) : [],
      fillGeometry: slide.fillGeometry ? safeDeepClone(slide.fillGeometry) : [],
      strokePaints: slide.strokePaints ? safeDeepClone(slide.strokePaints) : [],
      strokeWeight: slide.strokeWeight ?? 0,
      strokeAlign: slide.strokeAlign ?? "INSIDE"
    };
    outputNodes.push(frameNode);
    if (instanceNode && instanceNode.symbolData?.symbolID) {
      const symGuidStr = guidToString(instanceNode.symbolData.symbolID);
      const symbolNode = deckDoc.nodeMap.get(symGuidStr);
      if (symbolNode) {
        let collectSubtree2 = function(id) {
          if (visited.has(id)) return;
          visited.add(id);
          const node = deckDoc.nodeMap.get(id);
          if (!node || node.phase === "REMOVED") return;
          subtree.push(node);
          const kids = deckDoc.childrenMap.get(id) || [];
          for (const kid of kids) {
            collectSubtree2(guidToString(kid.guid));
          }
        };
        var collectSubtree = collectSubtree2;
        const subtree = [];
        const visited = /* @__PURE__ */ new Set();
        const symbolChildren = deckDoc.childrenMap.get(symGuidStr) || [];
        for (const child of symbolChildren) {
          collectSubtree2(guidToString(child.guid));
        }
        const idRemap = /* @__PURE__ */ new Map();
        for (const node of subtree) {
          idRemap.set(guidToString(node.guid), generateGuid());
        }
        const clonedSubtree = subtree.map((node) => {
          const clone = safeDeepClone(node);
          const origIdStr = guidToString(node.guid);
          const newGuid = idRemap.get(origIdStr);
          clone.guid = newGuid;
          clone.phase = "CREATED";
          delete clone.slideThumbnailHash;
          delete clone.editInfo;
          delete clone.prototypeInteractions;
          if (clone.parentIndex?.guid) {
            const parentIdStr = guidToString(clone.parentIndex.guid);
            if (parentIdStr === symGuidStr) {
              clone.parentIndex.guid = frameGuid;
            } else if (idRemap.has(parentIdStr)) {
              clone.parentIndex.guid = idRemap.get(parentIdStr);
            }
          }
          const overrides = instanceNode.symbolData?.symbolOverrides || [];
          const matchingOverrides = overrides.filter((o) => {
            if (!o.guidPath?.guids?.length) return false;
            const lastGuid = o.guidPath.guids[o.guidPath.guids.length - 1];
            return lastGuid.sessionID === node.guid.sessionID && lastGuid.localID === node.guid.localID;
          });
          for (const ov of matchingOverrides) {
            if (ov.textData && clone.textData) {
              let chars = ov.textData.characters || "";
              if (chars === "") chars = " ";
              clone.textData.characters = chars;
            }
            if (ov.fillPaints) {
              clone.fillPaints = safeDeepClone(ov.fillPaints);
            }
            if (ov.strokePaints) {
              clone.strokePaints = safeDeepClone(ov.strokePaints);
            }
          }
          return clone;
        });
        outputNodes.push(...clonedSubtree);
      }
    }
    for (const sibling of children) {
      let collectSiblingSubtree2 = function(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const node = deckDoc.nodeMap.get(id);
        if (!node || node.phase === "REMOVED") return;
        subtree.push(node);
        const kids = deckDoc.childrenMap.get(id) || [];
        for (const kid of kids) {
          collectSiblingSubtree2(guidToString(kid.guid));
        }
      };
      var collectSiblingSubtree = collectSiblingSubtree2;
      if (sibling.type === "INSTANCE" || sibling.phase === "REMOVED") continue;
      const subtree = [];
      const visited = /* @__PURE__ */ new Set();
      collectSiblingSubtree2(guidToString(sibling.guid));
      const sibIdRemap = /* @__PURE__ */ new Map();
      for (const node of subtree) {
        sibIdRemap.set(guidToString(node.guid), generateGuid());
      }
      const clonedSibNodes = subtree.map((node) => {
        const clone = safeDeepClone(node);
        const origIdStr = guidToString(node.guid);
        const newGuid = sibIdRemap.get(origIdStr);
        clone.guid = newGuid;
        clone.phase = "CREATED";
        if (clone.parentIndex?.guid) {
          const parentIdStr = guidToString(clone.parentIndex.guid);
          if (parentIdStr === slideId) {
            clone.parentIndex.guid = frameGuid;
          } else if (sibIdRemap.has(parentIdStr)) {
            clone.parentIndex.guid = sibIdRemap.get(parentIdStr);
          }
        }
        return clone;
      });
      outputNodes.push(...clonedSibNodes);
    }
  });
  const globalSupportTypes = /* @__PURE__ */ new Set([
    "VARIABLE",
    "VARIABLE_SET",
    "VARIABLE_COLLECTION",
    "PUBLISHED_VARIABLE_COLLECTION"
  ]);
  const supportNodes = deckDoc.nodes.filter(
    (n) => globalSupportTypes.has(n.type) && n.phase !== "REMOVED"
  );
  for (const sNode of supportNodes) {
    outputNodes.push(safeDeepClone(sNode));
  }
  const nodeMap = /* @__PURE__ */ new Map();
  const childrenMap = /* @__PURE__ */ new Map();
  for (const node of outputNodes) {
    const id = guidToString(node.guid);
    nodeMap.set(id, node);
  }
  for (const node of outputNodes) {
    if (!node.parentIndex?.guid) continue;
    const pid = guidToString(node.parentIndex.guid);
    if (!childrenMap.has(pid)) {
      childrenMap.set(pid, []);
    }
    childrenMap.get(pid).push(node);
  }
  const targetMeta = safeDeepClone(deckDoc.meta) || {};
  targetMeta.file_name = canvasName;
  const remapBlobRefs = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) remapBlobRefs(item);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (/Blob$/.test(key) && typeof child === "number") {
        value[key] = copyBlob(child);
      } else {
        remapBlobRefs(child);
      }
    }
  };
  for (const node of outputNodes) remapBlobRefs(node);
  const newDoc = {
    header: { prelude: "fig-kiwi", version: deckDoc.header.version },
    nodes: outputNodes,
    nodeMap,
    childrenMap,
    schema: safeDeepClone(deckDoc.schema),
    compiledSchema: deckDoc.compiledSchema,
    rawChunks: [
      deckDoc.rawChunks[0],
      // Schema chunk (will be re-deflated or kept as-is)
      new Uint8Array(0),
      // Placeholder for chunk 1 (pre-compressed canvas message)
      ...deckDoc.rawChunks.slice(2)
      // Remaining passthrough chunks
    ],
    message: {
      ...safeDeepClone(deckDoc.message),
      nodeChanges: outputNodes,
      blobs: outputBlobs
    },
    meta: targetMeta,
    thumbnail: safeDeepClone(deckDoc.thumbnail),
    images: safeDeepClone(deckDoc.images)
  };
  return newDoc;
}
function findFirstTextNode(doc, id) {
  const node = doc.nodeMap.get(id);
  if (!node || node.phase === "REMOVED") return null;
  if (node.type === "TEXT" && node.textData?.characters) return node;
  const children = doc.childrenMap.get(id) || [];
  for (const child of children) {
    const found = findFirstTextNode(doc, guidToString(child.guid));
    if (found) return found;
  }
  return null;
}

// src/schema.ts
var emptyFigTemplate = "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";

// src/template.ts
function b64decode(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function createEmptyFigDoc() {
  const bytes = b64decode(emptyFigTemplate);
  return parseFig(bytes);
}

// src/gradient.ts
var IDENTITY_TRANSFORM = {
  m00: 1,
  m01: 0,
  m02: 0,
  m10: 0,
  m11: 1,
  m12: 0
};
function cloneTransform(transform) {
  if (!transform) return { ...IDENTITY_TRANSFORM };
  return {
    m00: transform.m00,
    m01: transform.m01,
    m02: transform.m02,
    m10: transform.m10,
    m11: transform.m11,
    m12: transform.m12
  };
}
function isRenderableGradientPaint(paint) {
  return !!paint && paint.visible !== false && (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL") && Array.isArray(paint.stops) && paint.stops.length > 0;
}
function extractRenderableGradientFill(paints) {
  const paint = paints?.find((entry) => isRenderableGradientPaint(entry));
  if (!paint) return null;
  return {
    type: paint.type === "GRADIENT_LINEAR" ? "linear" : "radial",
    opacity: paint.opacity ?? 1,
    transform: cloneTransform(paint.transform),
    stops: [...paint.stops].sort((a, b) => a.position - b.position).map((stop) => ({
      position: stop.position,
      color: { ...stop.color },
      colorVar: stop.colorVar
    }))
  };
}
function resolveGradientGeometry(fill, width, height) {
  if (width <= 0 || height <= 0) return null;
  const transform = fill.transform ?? IDENTITY_TRANSFORM;
  const { m00, m01, m02, m10, m11, m12 } = transform;
  const det = m00 * m11 - m10 * m01;
  if (Math.abs(det) < 1e-12) return null;
  const ia = m11 / det;
  const ic = -m01 / det;
  const ie = (m01 * m12 - m11 * m02) / det;
  const ib = -m10 / det;
  const iid = m00 / det;
  const iif = (m10 * m02 - m00 * m12) / det;
  const point = (gx, gy) => ({
    x: (ia * gx + ic * gy + ie) * width,
    y: (ib * gx + iid * gy + iif) * height
  });
  if (fill.type === "linear") {
    return {
      type: "linear",
      start: point(0, 0.5),
      end: point(1, 0.5)
    };
  }
  const center = point(0.5, 0.5);
  const xAxisPoint = point(1, 0.5);
  const yAxisPoint = point(0.5, 1);
  return {
    type: "radial",
    center,
    radiusX: Math.hypot(xAxisPoint.x - center.x, xAxisPoint.y - center.y),
    radiusY: Math.hypot(yAxisPoint.x - center.x, yAxisPoint.y - center.y),
    angle: Math.atan2(xAxisPoint.y - center.y, xAxisPoint.x - center.x)
  };
}

// src/vector.ts
var CMD_CLOSE = 0;
var CMD_MOVE_TO = 1;
var CMD_LINE_TO = 2;
var CMD_CUBIC_TO = 4;
function quadraticToCubic(x0, y0, qx, qy, x, y) {
  return {
    type: "C",
    c1x: x0 + 2 / 3 * (qx - x0),
    c1y: y0 + 2 / 3 * (qy - y0),
    c2x: x + 2 / 3 * (qx - x),
    c2y: y + 2 / 3 * (qy - y),
    x,
    y
  };
}
function roundPathNumber(n, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
function getBlobBytes(doc, blobIndex) {
  if (blobIndex == null || blobIndex < 0) return null;
  const blob = doc.message?.blobs?.[blobIndex];
  if (!blob) return null;
  if (blob instanceof Uint8Array) return blob;
  if (blob.bytes instanceof Uint8Array) return blob.bytes;
  if (Array.isArray(blob.bytes)) return Uint8Array.from(blob.bytes);
  if (blob.bytes && typeof blob.bytes === "object") {
    const values = Object.values(blob.bytes);
    if (values.every((value) => typeof value === "number")) {
      return Uint8Array.from(values);
    }
  }
  return null;
}
function geometryBlobToSVGPath(blob) {
  if (!blob.length) return "";
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  let offset = 0;
  const parts = [];
  const canRead = (byteLength) => offset + byteLength <= blob.length;
  while (offset < blob.length) {
    const cmd = blob[offset++];
    switch (cmd) {
      case CMD_CLOSE:
        parts.push("Z");
        break;
      case CMD_MOVE_TO: {
        if (!canRead(8)) return parts.join("");
        const x = roundPathNumber(view.getFloat32(offset, true));
        const y = roundPathNumber(view.getFloat32(offset + 4, true));
        offset += 8;
        parts.push(`M${x} ${y}`);
        break;
      }
      case CMD_LINE_TO: {
        if (!canRead(8)) return parts.join("");
        const x = roundPathNumber(view.getFloat32(offset, true));
        const y = roundPathNumber(view.getFloat32(offset + 4, true));
        offset += 8;
        parts.push(`L${x} ${y}`);
        break;
      }
      case CMD_CUBIC_TO: {
        if (!canRead(24)) return parts.join("");
        const x1 = roundPathNumber(view.getFloat32(offset, true));
        const y1 = roundPathNumber(view.getFloat32(offset + 4, true));
        const x2 = roundPathNumber(view.getFloat32(offset + 8, true));
        const y2 = roundPathNumber(view.getFloat32(offset + 12, true));
        const x = roundPathNumber(view.getFloat32(offset + 16, true));
        const y = roundPathNumber(view.getFloat32(offset + 20, true));
        offset += 24;
        parts.push(`C${x1} ${y1} ${x2} ${y2} ${x} ${y}`);
        break;
      }
      default:
        return parts.join("");
    }
  }
  return parts.join("");
}
function parseSVGPathData(svgPath) {
  const tokens = [];
  const re = /([MmLlCcSsQqTtHhVvZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match;
  while ((match = re.exec(svgPath)) !== null) {
    if (match[1]) tokens.push(match[1]);
    else tokens.push(Number.parseFloat(match[2]));
  }
  const commands = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let prevC2x = 0;
  let prevC2y = 0;
  let prevQuadraticX = 0;
  let prevQuadraticY = 0;
  let cmd = "";
  const num = () => {
    const value = tokens[i++];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`Invalid SVG path data near token index ${i - 1}`);
    }
    return value;
  };
  while (i < tokens.length) {
    if (typeof tokens[i] === "string") cmd = tokens[i++];
    switch (cmd) {
      case "M":
        cx = num();
        cy = num();
        startX = cx;
        startY = cy;
        commands.push({ type: "M", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        cmd = "L";
        break;
      case "m":
        cx += num();
        cy += num();
        startX = cx;
        startY = cy;
        commands.push({ type: "M", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        cmd = "l";
        break;
      case "L":
        cx = num();
        cy = num();
        commands.push({ type: "L", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        break;
      case "l":
        cx += num();
        cy += num();
        commands.push({ type: "L", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        break;
      case "H":
        cx = num();
        commands.push({ type: "L", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        break;
      case "h":
        cx += num();
        commands.push({ type: "L", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        break;
      case "V":
        cy = num();
        commands.push({ type: "L", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        break;
      case "v":
        cy += num();
        commands.push({ type: "L", x: cx, y: cy });
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        break;
      case "C": {
        const c1x = num();
        const c1y = num();
        const c2x = num();
        const c2y = num();
        cx = num();
        cy = num();
        prevC2x = c2x;
        prevC2y = c2y;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        commands.push({ type: "C", c1x, c1y, c2x, c2y, x: cx, y: cy });
        break;
      }
      case "c": {
        const c1x = cx + num();
        const c1y = cy + num();
        const c2x = cx + num();
        const c2y = cy + num();
        cx += num();
        cy += num();
        prevC2x = c2x;
        prevC2y = c2y;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        commands.push({ type: "C", c1x, c1y, c2x, c2y, x: cx, y: cy });
        break;
      }
      case "S": {
        const c1x = 2 * cx - prevC2x;
        const c1y = 2 * cy - prevC2y;
        const c2x = num();
        const c2y = num();
        cx = num();
        cy = num();
        prevC2x = c2x;
        prevC2y = c2y;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        commands.push({ type: "C", c1x, c1y, c2x, c2y, x: cx, y: cy });
        break;
      }
      case "s": {
        const c1x = 2 * cx - prevC2x;
        const c1y = 2 * cy - prevC2y;
        const c2x = cx + num();
        const c2y = cy + num();
        cx += num();
        cy += num();
        prevC2x = c2x;
        prevC2y = c2y;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        commands.push({ type: "C", c1x, c1y, c2x, c2y, x: cx, y: cy });
        break;
      }
      case "Q": {
        const qx = num();
        const qy = num();
        const x = num();
        const y = num();
        const cubic = quadraticToCubic(cx, cy, qx, qy, x, y);
        commands.push(cubic);
        prevQuadraticX = qx;
        prevQuadraticY = qy;
        prevC2x = cubic.c2x;
        prevC2y = cubic.c2y;
        cx = x;
        cy = y;
        break;
      }
      case "q": {
        const qx = cx + num();
        const qy = cy + num();
        const x = cx + num();
        const y = cy + num();
        const cubic = quadraticToCubic(cx, cy, qx, qy, x, y);
        commands.push(cubic);
        prevQuadraticX = qx;
        prevQuadraticY = qy;
        prevC2x = cubic.c2x;
        prevC2y = cubic.c2y;
        cx = x;
        cy = y;
        break;
      }
      case "T": {
        const qx = 2 * cx - prevQuadraticX;
        const qy = 2 * cy - prevQuadraticY;
        const x = num();
        const y = num();
        const cubic = quadraticToCubic(cx, cy, qx, qy, x, y);
        commands.push(cubic);
        prevQuadraticX = qx;
        prevQuadraticY = qy;
        prevC2x = cubic.c2x;
        prevC2y = cubic.c2y;
        cx = x;
        cy = y;
        break;
      }
      case "t": {
        const qx = 2 * cx - prevQuadraticX;
        const qy = 2 * cy - prevQuadraticY;
        const x = cx + num();
        const y = cy + num();
        const cubic = quadraticToCubic(cx, cy, qx, qy, x, y);
        commands.push(cubic);
        prevQuadraticX = qx;
        prevQuadraticY = qy;
        prevC2x = cubic.c2x;
        prevC2y = cubic.c2y;
        cx = x;
        cy = y;
        break;
      }
      case "Z":
      case "z":
        commands.push({ type: "Z" });
        cx = startX;
        cy = startY;
        prevC2x = cx;
        prevC2y = cy;
        prevQuadraticX = cx;
        prevQuadraticY = cy;
        break;
      case "":
        i++;
        break;
      default:
        throw new Error(`Unsupported SVG path command: ${cmd}`);
    }
  }
  return commands;
}
function encodeCommandsBlob(commands, scaleX = 1, scaleY = 1) {
  let byteLength = 0;
  for (const command of commands) {
    byteLength += 1;
    if (command.type === "M" || command.type === "L") byteLength += 8;
    else if (command.type === "C") byteLength += 24;
  }
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  let offset = 0;
  for (const command of commands) {
    switch (command.type) {
      case "M":
        view.setUint8(offset++, CMD_MOVE_TO);
        view.setFloat32(offset, command.x * scaleX, true);
        offset += 4;
        view.setFloat32(offset, command.y * scaleY, true);
        offset += 4;
        break;
      case "L":
        view.setUint8(offset++, CMD_LINE_TO);
        view.setFloat32(offset, command.x * scaleX, true);
        offset += 4;
        view.setFloat32(offset, command.y * scaleY, true);
        offset += 4;
        break;
      case "C":
        view.setUint8(offset++, CMD_CUBIC_TO);
        view.setFloat32(offset, command.c1x * scaleX, true);
        offset += 4;
        view.setFloat32(offset, command.c1y * scaleY, true);
        offset += 4;
        view.setFloat32(offset, command.c2x * scaleX, true);
        offset += 4;
        view.setFloat32(offset, command.c2y * scaleY, true);
        offset += 4;
        view.setFloat32(offset, command.x * scaleX, true);
        offset += 4;
        view.setFloat32(offset, command.y * scaleY, true);
        offset += 4;
        break;
      case "Z":
        view.setUint8(offset++, CMD_CLOSE);
        break;
    }
  }
  return new Uint8Array(buffer, 0, offset);
}
function encodeVectorNetworkBlob(pathCommandsList, { emitRegions = true } = {}) {
  const vertices = [];
  const segments = [];
  const regions = [];
  for (const pathCommands of pathCommandsList) {
    const loops = [];
    let regionSegments = [];
    let firstVertex = -1;
    let prevVertex = -1;
    let prevX = 0;
    let prevY = 0;
    for (const command of pathCommands) {
      if (command.type === "M") {
        if (regionSegments.length > 0) {
          loops.push(regionSegments);
          regionSegments = [];
        }
        const vertexIndex = vertices.length;
        vertices.push({ x: command.x, y: command.y, styleID: 0 });
        firstVertex = vertexIndex;
        prevVertex = vertexIndex;
        prevX = command.x;
        prevY = command.y;
      } else if (command.type === "L") {
        const vertexIndex = vertices.length;
        vertices.push({ x: command.x, y: command.y, styleID: 0 });
        if (prevVertex >= 0) {
          regionSegments.push(segments.length);
          segments.push({
            start: { vertex: prevVertex, dx: 0, dy: 0 },
            end: { vertex: vertexIndex, dx: 0, dy: 0 },
            isStraight: true
          });
        }
        prevVertex = vertexIndex;
        prevX = command.x;
        prevY = command.y;
      } else if (command.type === "C") {
        const vertexIndex = vertices.length;
        vertices.push({ x: command.x, y: command.y, styleID: 0 });
        if (prevVertex >= 0) {
          const startDx = command.c1x - prevX;
          const startDy = command.c1y - prevY;
          const endDx = command.c2x - command.x;
          const endDy = command.c2y - command.y;
          regionSegments.push(segments.length);
          segments.push({
            start: { vertex: prevVertex, dx: startDx, dy: startDy },
            end: { vertex: vertexIndex, dx: endDx, dy: endDy },
            isStraight: startDx === 0 && startDy === 0 && endDx === 0 && endDy === 0
          });
        }
        prevVertex = vertexIndex;
        prevX = command.x;
        prevY = command.y;
      } else if (command.type === "Z") {
        if (prevVertex >= 0 && prevVertex !== firstVertex) {
          const lastPos = vertices[prevVertex];
          const firstPos = vertices[firstVertex];
          const dx = lastPos.x - firstPos.x;
          const dy = lastPos.y - firstPos.y;
          if (dx * dx + dy * dy < 1e-4) {
            const lastSeg = segments[segments.length - 1];
            if (lastSeg && lastSeg.end.vertex === prevVertex) {
              lastSeg.end.vertex = firstVertex;
              vertices.pop();
            }
          } else {
            regionSegments.push(segments.length);
            segments.push({
              start: { vertex: prevVertex, dx: 0, dy: 0 },
              end: { vertex: firstVertex, dx: 0, dy: 0 },
              isStraight: true
            });
          }
        }
        if (firstVertex >= 0) {
          prevVertex = firstVertex;
          prevX = vertices[firstVertex].x;
          prevY = vertices[firstVertex].y;
        }
      }
    }
    if (regionSegments.length > 0) loops.push(regionSegments);
    if (emitRegions && loops.length > 0) {
      regions.push({ windingRule: "NONZERO", styleID: 0, loops });
    }
  }
  return encodeVectorNetwork({ vertices, segments, regions });
}
function parseVectorNetworkBlob(bytes) {
  if (bytes.length < 12) {
    throw new Error(
      `vectorNetworkBlob too short: ${bytes.length} bytes, need at least 12 for header`
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const vertexCount = view.getUint32(offset, true);
  offset += 4;
  const segmentCount = view.getUint32(offset, true);
  offset += 4;
  const regionCount = view.getUint32(offset, true);
  offset += 4;
  const verticesEnd = 12 + vertexCount * 12;
  const segmentsEnd = verticesEnd + segmentCount * 28;
  if (verticesEnd > bytes.length) {
    throw new Error(
      `vertexCount ${vertexCount} runs past buffer: needs ${verticesEnd} bytes, have ${bytes.length}`
    );
  }
  if (segmentsEnd > bytes.length) {
    throw new Error(
      `segmentCount ${segmentCount} runs past buffer: needs ${segmentsEnd} bytes, have ${bytes.length}`
    );
  }
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    const styleID = view.getUint32(offset, true);
    offset += 4;
    const x = view.getFloat32(offset, true);
    offset += 4;
    const y = view.getFloat32(offset, true);
    offset += 4;
    vertices.push({ x, y, styleID });
  }
  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    const segmentOffset = offset;
    offset += 4;
    const startVertex = view.getUint32(offset, true);
    offset += 4;
    const tsx = view.getFloat32(offset, true);
    offset += 4;
    const tsy = view.getFloat32(offset, true);
    offset += 4;
    const endVertex = view.getUint32(offset, true);
    offset += 4;
    const tex = view.getFloat32(offset, true);
    offset += 4;
    const tey = view.getFloat32(offset, true);
    offset += 4;
    if (startVertex >= vertexCount) {
      throw new Error(
        `segment ${i} startVertex ${startVertex} out of range (vertexCount ${vertexCount}) at offset ${segmentOffset}`
      );
    }
    if (endVertex >= vertexCount) {
      throw new Error(
        `segment ${i} endVertex ${endVertex} out of range (vertexCount ${vertexCount}) at offset ${segmentOffset}`
      );
    }
    segments.push({
      start: { vertex: startVertex, dx: tsx, dy: tsy },
      end: { vertex: endVertex, dx: tex, dy: tey },
      isStraight: tsx === 0 && tsy === 0 && tex === 0 && tey === 0
    });
  }
  const regions = [];
  for (let r = 0; r < regionCount; r++) {
    if (offset + 8 > bytes.length) {
      throw new Error(
        `region ${r} header runs past buffer at offset ${offset} (have ${bytes.length} bytes)`
      );
    }
    const packed = view.getUint32(offset, true);
    offset += 4;
    const numLoops = view.getUint32(offset, true);
    offset += 4;
    const windingRule = packed & 1 ? "NONZERO" : "ODD";
    const styleID = packed >> 1;
    const loops = [];
    for (let l = 0; l < numLoops; l++) {
      if (offset + 4 > bytes.length) {
        throw new Error(
          `region ${r} loop ${l} segCount runs past buffer at offset ${offset} (have ${bytes.length} bytes)`
        );
      }
      const segCount = view.getUint32(offset, true);
      offset += 4;
      if (offset + segCount * 4 > bytes.length) {
        throw new Error(
          `region ${r} loop ${l} declares ${segCount} segment indices, runs past buffer at offset ${offset} (have ${bytes.length} bytes)`
        );
      }
      const loop = [];
      for (let s = 0; s < segCount; s++) {
        const segIndex = view.getUint32(offset, true);
        offset += 4;
        if (segIndex >= segmentCount) {
          throw new Error(
            `region ${r} loop ${l} segment index ${segIndex} out of range (segmentCount ${segmentCount})`
          );
        }
        loop.push(segIndex);
      }
      loops.push(loop);
    }
    regions.push({ windingRule, styleID, loops });
  }
  if (offset !== bytes.length) {
    throw new Error(
      `trailing bytes: parsed ${offset} bytes but buffer is ${bytes.length} bytes long`
    );
  }
  return { vertices, segments, regions, bytesConsumed: offset };
}
function encodeVectorNetwork(network) {
  let regionsByteLength = 0;
  for (const region of network.regions) {
    regionsByteLength += 8;
    for (const loop of region.loops) regionsByteLength += 4 + loop.length * 4;
  }
  const totalByteLength = 12 + network.vertices.length * 12 + network.segments.length * 28 + regionsByteLength;
  const buffer = new ArrayBuffer(totalByteLength);
  const view = new DataView(buffer);
  let offset = 0;
  view.setUint32(offset, network.vertices.length, true);
  offset += 4;
  view.setUint32(offset, network.segments.length, true);
  offset += 4;
  view.setUint32(offset, network.regions.length, true);
  offset += 4;
  for (const vertex of network.vertices) {
    view.setUint32(offset, vertex.styleID, true);
    offset += 4;
    view.setFloat32(offset, vertex.x, true);
    offset += 4;
    view.setFloat32(offset, vertex.y, true);
    offset += 4;
  }
  for (const segment of network.segments) {
    view.setUint32(offset, 0, true);
    offset += 4;
    view.setUint32(offset, segment.start.vertex, true);
    offset += 4;
    view.setFloat32(offset, segment.start.dx, true);
    offset += 4;
    view.setFloat32(offset, segment.start.dy, true);
    offset += 4;
    view.setUint32(offset, segment.end.vertex, true);
    offset += 4;
    view.setFloat32(offset, segment.end.dx, true);
    offset += 4;
    view.setFloat32(offset, segment.end.dy, true);
    offset += 4;
  }
  for (const region of network.regions) {
    const packed = region.styleID << 1 | (region.windingRule === "NONZERO" ? 1 : 0);
    view.setUint32(offset, packed, true);
    offset += 4;
    view.setUint32(offset, region.loops.length, true);
    offset += 4;
    for (const loop of region.loops) {
      view.setUint32(offset, loop.length, true);
      offset += 4;
      for (const segmentIndex of loop) {
        view.setUint32(offset, segmentIndex, true);
        offset += 4;
      }
    }
  }
  return new Uint8Array(buffer, 0, offset);
}
function cloneStyleOverrides(styleOverrideTable) {
  if (!styleOverrideTable?.length) return void 0;
  return JSON.parse(JSON.stringify(styleOverrideTable));
}
function toCommands(input) {
  if (Array.isArray(input.commands) && input.commands.length > 0) {
    return input.commands.map((command) => ({ ...command }));
  }
  if (input.svgPath) return parseSVGPathData(input.svgPath);
  throw new Error("Vector geometry input requires either svgPath or commands");
}
function appendVectorPayloadToDocument(doc, input) {
  const blobs = doc.message?.blobs ?? (doc.message.blobs = []);
  const normalizedWidth = input.normalizedWidth ?? input.width;
  const normalizedHeight = input.normalizedHeight ?? input.height;
  const scaleX = normalizedWidth === 0 ? 1 : input.width / normalizedWidth;
  const scaleY = normalizedHeight === 0 ? 1 : input.height / normalizedHeight;
  const fillPaths = (input.fillPaths ?? []).map(toCommands);
  const strokePaths = (input.strokePaths ?? []).map(toCommands);
  if (fillPaths.length === 0 && strokePaths.length === 0) {
    throw new Error("Vector payload requires at least one fill or stroke path");
  }
  const fillGeometry = [];
  for (let i = 0; i < fillPaths.length; i++) {
    const bytes = encodeCommandsBlob(fillPaths[i], scaleX, scaleY);
    blobs.push({ bytes });
    const path = input.fillPaths?.[i];
    fillGeometry.push({
      windingRule: path?.windingRule ?? "NONZERO",
      commandsBlob: blobs.length - 1,
      styleID: path?.styleID ?? 0
    });
  }
  const strokeGeometry = [];
  for (let i = 0; i < strokePaths.length; i++) {
    const bytes = encodeCommandsBlob(strokePaths[i], scaleX, scaleY);
    blobs.push({ bytes });
    const path = input.strokePaths?.[i];
    strokeGeometry.push({
      windingRule: path?.windingRule ?? "NONZERO",
      commandsBlob: blobs.length - 1,
      styleID: path?.styleID ?? 0
    });
  }
  const vectorNetworkBlob = encodeVectorNetworkBlob([...fillPaths, ...strokePaths]);
  blobs.push({ bytes: vectorNetworkBlob });
  return {
    fillGeometry,
    strokeGeometry,
    vectorData: {
      vectorNetworkBlob: blobs.length - 1,
      normalizedSize: { x: normalizedWidth, y: normalizedHeight },
      ...cloneStyleOverrides(input.styleOverrideTable)?.length ? { styleOverrideTable: cloneStyleOverrides(input.styleOverrideTable) } : {}
    }
  };
}
function getStyleOverrideTable(node) {
  const table = node.vectorData?.styleOverrideTable;
  return Array.isArray(table) ? table : [];
}
function resolveFillPaints(node, styleID) {
  if (!styleID) return node.fillPaints;
  const override = getStyleOverrideTable(node).find((entry) => entry?.styleID === styleID);
  if (!override || !("fillPaints" in override)) return node.fillPaints;
  return override.fillPaints;
}
function resolveGeometry(doc, node, geometry, kind) {
  if (!Array.isArray(geometry) || geometry.length === 0) return [];
  const resolved = geometry.map((entry) => {
    if (typeof entry?.commandsBlob !== "number") return null;
    const bytes = getBlobBytes(doc, entry.commandsBlob);
    if (!bytes) return null;
    const svgPath = geometryBlobToSVGPath(bytes);
    if (!svgPath) return null;
    const path = {
      blobIndex: entry.commandsBlob,
      commandsBlob: bytes,
      svgPath,
      windingRule: entry.windingRule,
      styleID: entry.styleID || 0,
      paints: kind === "fill" ? resolveFillPaints(node, entry.styleID || 0) : node.strokePaints
    };
    return path;
  });
  return resolved.filter((entry) => entry !== null);
}
function resolveVectorNodePaths(doc, node) {
  return {
    fill: resolveGeometry(doc, node, node.fillGeometry, "fill"),
    stroke: resolveGeometry(doc, node, node.strokeGeometry, "stroke")
  };
}

// src/color.ts
function hexToFigColor(hex) {
  if (!hex || hex === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const a = h.length >= 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}
function parseCssRgbColor(value) {
  const match = value.trim().match(/^rgba?\((.+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length < 3) return null;
  const r = Number.parseFloat(parts[0]);
  const g = Number.parseFloat(parts[1]);
  const b = Number.parseFloat(parts[2]);
  const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return { r: r / 255, g: g / 255, b: b / 255, a };
}
function cssColorToFigColor(value, resolveNamed) {
  const trimmed = value.trim();
  if (trimmed === "transparent" || trimmed === "none") return { r: 0, g: 0, b: 0, a: 0 };
  if (trimmed.startsWith("#")) return hexToFigColor(trimmed);
  const rgba = parseCssRgbColor(trimmed);
  if (rgba) return rgba;
  if (resolveNamed) {
    const resolved = resolveNamed(trimmed);
    if (resolved) return resolved;
  }
  throw new Error(`Unsupported CSS color: ${value}`);
}
function makeSolidPaint(fill, resolveNamed) {
  const color = cssColorToFigColor(fill, resolveNamed);
  return {
    type: "SOLID",
    color: { r: color.r, g: color.g, b: color.b, a: 1 },
    opacity: color.a,
    visible: true,
    blendMode: "NORMAL"
  };
}

// src/svgPath.ts
function serializeSvgPathData(commands) {
  return commands.map((command) => {
    switch (command.type) {
      case "M":
        return `M${command.x} ${command.y}`;
      case "L":
        return `L${command.x} ${command.y}`;
      case "C":
        return `C${command.c1x} ${command.c1y} ${command.c2x} ${command.c2y} ${command.x} ${command.y}`;
      case "Z":
        return "Z";
    }
  }).join(" ");
}
function transformSvgPathData(svgPath, {
  scaleX = 1,
  scaleY = 1,
  translateX = 0,
  translateY = 0
}) {
  const commands = parseSVGPathData(svgPath).map((command) => {
    switch (command.type) {
      case "M":
      case "L":
        return {
          ...command,
          x: command.x * scaleX + translateX,
          y: command.y * scaleY + translateY
        };
      case "C":
        return {
          ...command,
          c1x: command.c1x * scaleX + translateX,
          c1y: command.c1y * scaleY + translateY,
          c2x: command.c2x * scaleX + translateX,
          c2y: command.c2y * scaleY + translateY,
          x: command.x * scaleX + translateX,
          y: command.y * scaleY + translateY
        };
      case "Z":
        return command;
    }
  });
  return serializeSvgPathData(commands);
}
function mapStrokeJoin(value) {
  switch ((value || "").toLowerCase()) {
    case "round":
      return "ROUND";
    case "bevel":
      return "BEVEL";
    default:
      return "MITER";
  }
}
function mapStrokeCap(value) {
  switch ((value || "").toLowerCase()) {
    case "round":
      return "ROUND";
    case "square":
      return "SQUARE";
    default:
      return "NONE";
  }
}
export {
  appendVectorPayloadToDocument,
  assembleCanvasFig,
  convertDeckToFig,
  createEmptyFigDoc,
  createFigZip,
  cssColorToFigColor,
  encodeCommandsBlob,
  encodeFigParts,
  encodeVectorNetwork,
  encodeVectorNetworkBlob,
  extractRenderableGradientFill,
  geometryBlobToSVGPath,
  getBlobBytes,
  hexToFigColor,
  makeSolidPaint,
  mapStrokeCap,
  mapStrokeJoin,
  nodeId,
  parseCssRgbColor,
  parseFig,
  parseFigBinary,
  parseSVGPathData,
  parseVectorNetworkBlob,
  resolveGradientGeometry,
  resolveVectorNodePaths,
  serializeSvgPathData,
  transformSvgPathData
};
//# sourceMappingURL=index.js.map