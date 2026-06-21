.mp3 files placed in this folder will be available via the un-mute button in the application.
No subdirectories will be scanned, and music will be played in a random order.
The default folder will be used only if no .mp3 files are found in this /server/music folder

##### Linux command for calculating the total run time of all mp3s in a given folder ####
find . -maxdepth 1 -type f -iname '*.mp3' -print0 |
xargs -0 -I{} ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 "{}" |
awk '{s+=$1} END {printf "Total play time: %02d:%02d:%02d\n", s/3600, (s%3600)/60, s%60}'
#########################################################################################