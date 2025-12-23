const songListEl = document.getElementById("song-list");
const lyricsView = document.getElementById("lyrics-view");
const lyricsEl = document.getElementById("lyrics");
const titleEl = document.getElementById("song-title");
const backBtn = document.getElementById("back");
const searchInput = document.getElementById("search");

let songs = [];

fetch("songs.json")
  .then(res => res.json())
  .then(data => {
    songs = data;
    renderList(songs);
  });

function renderList(items) {
  songListEl.innerHTML = "";
  items.forEach(song => {
    const li = document.createElement("li");
    li.textContent = song.title;
    li.onclick = () => openSong(song);
    songListEl.appendChild(li);
  });
}

function openSong(song) {
  titleEl.textContent = song.title;
  lyricsEl.textContent = song.lyrics;
  lyricsView.classList.remove("hidden");
  songListEl.style.display = "none";
  searchInput.style.display = "none";
}

backBtn.onclick = () => {
  lyricsView.classList.add("hidden");
  songListEl.style.display = "block";
  searchInput.style.display = "block";
};

searchInput.addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  const filtered = songs.filter(song =>
    song.title.toLowerCase().includes(q)
  );
  renderList(filtered);
});