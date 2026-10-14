#!/bin/sh
# Converts a recorded take (webm) to the mp4 n8n's Creator Portal accepts:
# H.264, 1920x1080, 30 fps, no audio, under 100 MB. The take is not cut;
# --trim-start / --trim-end only drop dead time at the very start and end.
#
#   sh encode.sh out/take-....webm [--trim-start 1.5] [--trim-end 2]
set -eu

in="${1:?usage: encode.sh <take.webm> [--trim-start S] [--trim-end S]}"
shift
start=0
end_trim=0
while [ $# -gt 0 ]; do
	case "$1" in
		--trim-start) start="$2"; shift 2 ;;
		--trim-end) end_trim="$2"; shift 2 ;;
		*) echo "unknown option $1" >&2; exit 1 ;;
	esac
done

out="${in%.webm}.mp4"
# Playwright webm files often lack a duration header: read it from a decode pass.
duration=$(ffmpeg -nostats -i "$in" -f null - 2>&1 | sed -n 's/.*time=\([0-9:.]*\).*/\1/p' | tail -1 \
	| awk -F: '{ print $1 * 3600 + $2 * 60 + $3 }')
length=$(awk -v d="$duration" -v s="$start" -v e="$end_trim" 'BEGIN { print d - s - e }')
if ! awk -v l="$length" 'BEGIN { exit !(l > 0) }'; then
	echo "Nothing left to encode: the take is ${duration:-?} s, trimming $start + $end_trim s." >&2
	exit 1
fi

ffmpeg -v error -y -ss "$start" -i "$in" -t "$length" \
	-vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" \
	-c:v libx264 -preset slow -crf 20 -movflags +faststart -an "$out"

size=$(wc -c < "$out" | tr -d ' ')
echo "$out: $(printf '%.0f' "$length") s, $((size / 1024 / 1024)) MB"
if [ "$size" -gt 104857600 ]; then
	echo "Larger than 100 MB: re-run with a higher -crf." >&2
	exit 1
fi
