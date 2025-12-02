let books = [];

async function loadBooks() {
  try {
    const response = await fetch('/assets/data/books.json');
    if (!response.ok) {
      throw new Error('Failed to load books.json: ' + response.status);
    }
    books = await response.json();
    renderBooks(books);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadBooks();

  const sortSelect = document.getElementById('sortSelect');
  sortSelect.addEventListener('change', handleSortChange);
});

function renderBooks(list) {
  const container = document.getElementById('booksContainer');
  container.innerHTML = '';

  list.forEach(book => {
    const article = document.createElement('article');
    article.className = 'book-entry';

    article.innerHTML = `
      <img src="${book.cover}" alt="${book.title} cover" class="book-cover">

      <div class="book-content">
        <h2 class="book-title">
          <a href="${book.amazonUrl}" target="_blank" rel="noopener noreferrer">
            ${book.title} - by ${book.author}
          </a>
        </h2>

        <p class="book-meta">
          Date read: ${book.dateRead}. 
          How strongly I recommend it: ${book.rating}/10
        </p>

        <p class="book-notes">
          ${book.notes && book.notes.trim().length > 0
            ? book.notes
            : "No notes yet."}
        </p>

        <p class="book-links">
          <a href="#"
             class="notes-link"
             onclick="return false;">
            Read my notes
          </a>,
          or go to the
          <a href="${book.amazonUrl}"
             target="_blank"
             rel="noopener noreferrer">
            Amazon page
          </a>
          for details and reviews.
        </p>
      </div>
    `;

    container.appendChild(article);
  });
}

function handleSortChange(e) {
  const value = e.target.value;

  // copy so we don't mutate the original array
  const sorted = [...books];

  if (value === 'title') {
    // A → Z by title
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (value === 'newest') {
    // YYYY-MM-DD strings can be compared directly; larger = newer
    sorted.sort((a, b) => {
      if (a.dateRead < b.dateRead) return 1;
      if (a.dateRead > b.dateRead) return -1;
      return 0;
    });
  }

  if (value === 'rating') {
    // Highest recommendation first (10 → 1)
    sorted.sort((a, b) => b.rating - a.rating);
  }

  renderBooks(sorted);
}

function updateBookCount() {
  const countEl = document.getElementById('bookCount');
  if (!countEl) return;

  // You can tweak this if you ever want to exclude some books
  const total = books.length;
  countEl.textContent = total;
}

async function loadBooks() {
  try {
    const response = await fetch('/assets/data/books.json');
    if (!response.ok) {
      throw new Error('Failed to load books.json: ' + response.status);
    }
    books = await response.json();
    updateBookCount();   // 🔹 new line
    renderBooks(books);
  } catch (err) {
    console.error(err);
  }
}
