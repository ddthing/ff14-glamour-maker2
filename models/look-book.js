/* Copy a saved look, including independent original/cutout storage records.
   Blob URLs are immutable display handles; asset keys must never be shared. */
const LookBook = (() => {
  async function copy(source, { createId, readAsset, writeAsset, isCurrent }) {
    const { history, redo, ...saved } = source;
    const result = structuredClone(saved);
    result.id = createId();
    result.title = `${(source.title || "새로운 룩").slice(0, 60)} 복사본`;
    const copiedKeys = new Map();
    for (const character of result.editor?.characters || []) {
      if (!isCurrent()) return null;
      const runtimeSrc = character.src;
      const runtimeOriginalSrc = character.originalSrc;
      if (!character.assetKey) {
        if (runtimeSrc || runtimeOriginalSrc) throw new Error("저장되지 않은 사진이 있습니다. 사진을 다시 추가한 뒤 복제해주세요.");
        continue;
      }
      // A Blob URL is a process-local handle, not part of the saved look.
      // Carrying it into the copy would let cleanup of one look revoke the
      // other look's live image.
      character.src = "";
      character.originalSrc = "";
      const originalKey = character.assetKey;
      if (!copiedKeys.has(originalKey)) {
        const asset = await readAsset(originalKey);
        if (!isCurrent()) return null;
        if (!asset?.originalBlob || (character.cutout && !asset.cutoutBlob)) {
          throw new Error("사진 원본을 읽지 못했습니다. 사진을 다시 추가한 뒤 복제해주세요.");
        }
        const key = createId();
        await writeAsset(key, { originalBlob: asset.originalBlob, cutoutBlob: asset.cutoutBlob || null });
        if (!isCurrent()) return null;
        copiedKeys.set(originalKey, key);
      }
      character.assetKey = copiedKeys.get(originalKey);
    }
    return result;
  }
  return { copy };
})();
if (typeof module !== "undefined") module.exports = LookBook;
