export const ASSETS_LIST = [
  { id: "kitchen", src: "images/kitchen.png" },
  { id: "dishwasher", src: "images/dishwasher.png" },
  { id: "fork", src: "images/fork.png" },
  { id: "plate", src: "images/plate.png" },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load " + src));
    img.src = src;
  });
}

export async function preloadAssets(list, onProgress = () => {}) {
  const map = new Map();
  let loaded = 0;
  await Promise.all(
    list.map(async (entry) => {
      try {
        const img = await loadImage(entry.src);
        map.set(entry.id, img);
      } catch (err) {
        console.warn(err);
        map.set(entry.id, null);
      } finally {
        loaded++;
        onProgress(loaded / list.length);
      }
    })
  );
  return map;
}
