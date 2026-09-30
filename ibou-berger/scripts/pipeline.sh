#!/usr/bin/env bash
# Pipeline du vol Higgsfield → séquence d'images du site.
# Usage : scripts/pipeline.sh clipA.mp4 clipB.mp4 clipC.mp4
# Nécessite ffmpeg (Higgsfield sandbox_exec, Homebrew, ou `npm i -g ffmpeg-static`).
set -euo pipefail
OUT=${OUT:-work}; mkdir -p "$OUT"
FPS_SEQ=${FPS_SEQ:-20}; SEQ_W=${SEQ_W:-1440}; Q=${Q:-78}

# 1. Inspection de chaque clip : planche contact (2 i/s) + détection de coupe
for f in "$@"; do
  b=$(basename "$f" .mp4)
  ffmpeg -loglevel error -y -i "$f" -vf "fps=2,scale=320:-2,tile=6x6" -frames:v 1 "$OUT/$b-sheet.jpg"
  echo "== coupes détectées dans $b (aucune ligne = pas de coupe)"
  ffmpeg -hide_banner -i "$f" -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep -o "pts_time:[0-9.]*" || true
  ffmpeg -loglevel error -y -sseof -0.05 -i "$f" -frames:v 1 "$OUT/$b-last.png"
  ffmpeg -loglevel error -y -i "$f" -frames:v 1 "$OUT/$b-first.png"
done
echo "Comparer $OUT/*-last.png avec le *-first.png du clip suivant."

# 2. Normalisation + assemblage (concat dur : les extensions se raccordent déjà)
: > "$OUT/list.txt"
for f in "$@"; do
  b=$(basename "$f" .mp4)
  ffmpeg -loglevel error -y -i "$f" -an -vf "scale=1920:1080:flags=lanczos,fps=24,format=yuv420p,setsar=1" -c:v libx264 -crf 16 "$OUT/$b-norm.mp4"
  echo "file '$b-norm.mp4'" >> "$OUT/list.txt"
done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/flythrough-master.mp4"
# Pour une jonction réparée : xfade=transition=fade:duration=0.125 à la place du concat.
echo "== coupes dans le master"
ffmpeg -hide_banner -i "$OUT/flythrough-master.mp4" -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep -o "pts_time:[0-9.]*" || true
ffmpeg -loglevel error -y -i "$OUT/flythrough-master.mp4" -vf "fps=1,scale=320:-2,tile=8x6" -frames:v 1 "$OUT/master-sheet.jpg"

# 3. Séquence d'images pour le navigateur
rm -rf "$OUT/frames"; mkdir -p "$OUT/frames"
ffmpeg -loglevel error -i "$OUT/flythrough-master.mp4" -an -vf "fps=$FPS_SEQ,scale=$SEQ_W:-2:flags=lanczos" -c:v libwebp -quality "$Q" -start_number 0 "$OUT/frames/frame-%04d.webp"
COUNT=$(ls "$OUT/frames" | wc -l)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/flythrough-master.mp4")
H=$(ffprobe -v error -select_streams v -show_entries stream=height -of csv=p=0 "$OUT/frames/frame-0000.webp")
cat > "$OUT/manifest.json" <<JSON
{
  "source": "higgsfield-master",
  "version": "$(date +%Y%m%d%H%M%S)",
  "fps": $FPS_SEQ, "count": $COUNT, "duration": $DUR, "width": $SEQ_W, "height": $H,
  "pattern": "frames/frame-{index4}.webp",
  "poster": "frames/frame-0000.webp"
}
JSON
du -sh "$OUT/frames"
echo "Copier $OUT/frames et $OUT/manifest.json dans public/flight/, puis ajuster les secondes de src/content.js (beats) si la durée change."
