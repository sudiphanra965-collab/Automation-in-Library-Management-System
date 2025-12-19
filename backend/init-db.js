// init-db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    is_admin INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    author TEXT,
    isbn TEXT,
    category TEXT,
    description TEXT,
    image TEXT,
    available INTEGER DEFAULT 1,
    publisher TEXT,
    year INTEGER,
    abstract TEXT,
    toc TEXT,
    subjects TEXT
  )`);

  // Best-effort add columns if table existed from older schema (ignore errors)
  const safeAdd = (sql) => db.run(sql, (e)=>{});
  safeAdd(`ALTER TABLE books ADD COLUMN publisher TEXT`);
  safeAdd(`ALTER TABLE books ADD COLUMN year INTEGER`);
  safeAdd(`ALTER TABLE books ADD COLUMN abstract TEXT`);
  safeAdd(`ALTER TABLE books ADD COLUMN toc TEXT`);
  safeAdd(`ALTER TABLE books ADD COLUMN subjects TEXT`);

  // Create FTS5 index (content=rowid maps to books.id)
  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
    title, author, isbn, publisher, year, abstract, toc, subjects, category,
    content='books', content_rowid='id', tokenize='porter'
  )`);

  // Triggers to keep FTS in sync
  db.run(`CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN
    INSERT INTO books_fts(rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES (new.id, new.title, new.author, new.isbn, new.publisher, new.year, new.abstract, new.toc, new.subjects, new.category);
  END`);
  db.run(`CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES('delete', old.id, old.title, old.author, old.isbn, old.publisher, old.year, old.abstract, old.toc, old.subjects, old.category);
    INSERT INTO books_fts(rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES (new.id, new.title, new.author, new.isbn, new.publisher, new.year, new.abstract, new.toc, new.subjects, new.category);
  END`);
  db.run(`CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES('delete', old.id, old.title, old.author, old.isbn, old.publisher, old.year, old.abstract, old.toc, old.subjects, old.category);
  END`);

  db.run(`CREATE TABLE IF NOT EXISTS borrowed_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    user_id INTEGER,
    borrowed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    returned_date DATETIME,
    borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Add new columns to existing borrowed_books table (safe add)
  safeAdd(`ALTER TABLE borrowed_books ADD COLUMN borrowed_date DATETIME DEFAULT CURRENT_TIMESTAMP`);
  safeAdd(`ALTER TABLE borrowed_books ADD COLUMN due_date DATETIME`);
  safeAdd(`ALTER TABLE borrowed_books ADD COLUMN returned_date DATETIME`);
  
  // Update existing records to have proper borrowed_date if they only have borrow_date
  db.run(`UPDATE borrowed_books SET borrowed_date = borrow_date WHERE borrowed_date IS NULL AND borrow_date IS NOT NULL`, (err) => {
    if (err) console.log('Note: Could not update existing borrow dates (table may be new)');
  });
  
  // Set due_date for existing records that don't have one (14 days from borrowed_date)
  db.run(`UPDATE borrowed_books SET due_date = datetime(COALESCE(borrowed_date, borrow_date, CURRENT_TIMESTAMP), '+14 days') WHERE due_date IS NULL`, (err) => {
    if (err) console.log('Note: Could not set due dates for existing records');
  });

  // Seed sample books (if empty)
  db.get('SELECT COUNT(*) AS c FROM books', (err, row) => {
    if (err) { console.error(err); db.close(); return; }
    if (row.c === 0) {
      const samples = [
        // Science - Enhanced with metadata
        ["Cosmos", "Carl Sagan", "9780345539434", "Science", "A journey through the universe exploring astronomy and cosmology", "/uploads/science.jpg", "Ballantine Books", 1980, 
         "Cosmos traces the origins of knowledge and the scientific method, mixing science with philosophy, and speculating to the future of science. Sagan rejects an anthropocentric viewpoint of the universe, considering it in its proper cosmic context.", 
         "Chapter 1: The Shores of the Cosmic Ocean\nChapter 2: One Voice in the Cosmic Fugue\nChapter 3: The Harmony of Worlds\nChapter 4: Heaven and Hell\nChapter 5: Blues for a Red Planet", 
         "astronomy, cosmology, science, philosophy, universe, space exploration"],
        
        ["A Brief History of Time", "Stephen Hawking", "9780553380163", "Science", "From the Big Bang to black holes - cosmology explained", "/uploads/science.jpg", "Bantam Books", 1988,
         "A landmark volume in science writing by one of the great minds of our time, Stephen Hawking's book explores such profound questions as: How did the universe begin—and what made its start possible?",
         "Chapter 1: Our Picture of the Universe\nChapter 2: Space and Time\nChapter 3: The Expanding Universe\nChapter 4: The Uncertainty Principle\nChapter 5: Elementary Particles and the Forces of Nature",
         "physics, cosmology, black holes, quantum mechanics, relativity, time, space"],
        
        ["The Selfish Gene", "Richard Dawkins", "9780198788607", "Science", "Revolutionary approach to evolutionary biology", "/uploads/science.jpg", "Oxford University Press", 1976,
         "The Selfish Gene caused a wave of excitement among biologists and general readers alike when it was first published in 1976. Professor Dawkins articulates a gene's eye view of evolution.",
         "Chapter 1: Why are people?\nChapter 2: The replicators\nChapter 3: Immortal coils\nChapter 4: The gene machine\nChapter 5: Aggression: stability and the selfish machine",
         "evolution, biology, genetics, natural selection, behavioral ecology"],
        
        // Technology - Enhanced with metadata  
        ["Code Complete", "Steve McConnell", "9780735619678", "Technology", "A practical handbook of software construction", "/uploads/technology.jpg", "Microsoft Press", 2004,
         "Widely considered one of the best practical guides to programming, Steve McConnell's original CODE COMPLETE has been helping developers write better software for more than a decade.",
         "Part I: Laying the Foundation\nChapter 1: Welcome to Software Construction\nChapter 2: Metaphors for a Richer Understanding of Software Development\nPart II: Creating High-Quality Code\nChapter 3: Measure Twice, Cut Once: Upstream Prerequisites",
         "software engineering, programming, code quality, software construction, best practices"],
        
        ["Introduction to Algorithms", "Thomas H. Cormen", "9780262033848", "Technology", "Comprehensive textbook on algorithms and data structures", "/uploads/technology.jpg", "MIT Press", 2009,
         "Some books on algorithms are rigorous but incomplete; others cover masses of material but lack rigor. Introduction to Algorithms uniquely combines rigor and comprehensiveness.",
         "Part I: Foundations\nChapter 1: The Role of Algorithms in Computing\nChapter 2: Getting Started\nPart II: Sorting and Order Statistics\nChapter 6: Heapsort\nChapter 7: Quicksort",
         "algorithms, data structures, computer science, programming, complexity analysis"],
        
        ["Zero to One", "Peter Thiel", "9780804139298", "Technology", "Notes on startups and building the future", "/uploads/technology.jpg", "Crown Business", 2014,
         "The great secret of our time is that there are still uncharted frontiers to explore and new inventions to create. In Zero to One, legendary entrepreneur and investor Peter Thiel shows how we can find singular ways to create those new things.",
         "Chapter 1: The Challenge of the Future\nChapter 2: Party Like It's 1999\nChapter 3: All Happy Companies Are Different\nChapter 4: The Ideology of Competition\nChapter 5: Last Mover Advantage",
         "entrepreneurship, startups, innovation, business strategy, technology, venture capital"],
        
        // Engineering - Enhanced with metadata
        ["Structures: Or Why Things Don't Fall Down", "J.E. Gordon", "9780306812835", "Engineering", "The science of structural engineering explained", "/uploads/engineering.jpg", "Da Capo Press", 1978,
         "In a book that will appeal to engineers and general readers alike, J.E. Gordon strips engineering of its confusing technical terms, communicating its founding principles in accessible, witty prose.",
         "Chapter 1: Why structures carry loads\nChapter 2: The invention of stress and strain\nChapter 3: The invention of the factor of safety\nChapter 4: Stress concentrations\nChapter 5: Strain energy and modern fracture mechanics",
         "structural engineering, mechanics, materials science, physics, construction"],
        
        ["The Design of Everyday Things", "Don Norman", "9780465050659", "Engineering", "The psychology of good design and usability", "/uploads/engineering.jpg", "Basic Books", 2013,
         "Even the smartest among us can feel inept as we fail to figure out which light switch or oven burner to turn on, or whether to push, pull, or slide a door. The fault lies not in ourselves, but in product design.",
         "Chapter 1: The Psychopathology of Everyday Things\nChapter 2: The Psychology of Everyday Actions\nChapter 3: Knowledge in the Head and in the World\nChapter 4: Knowing What to Do\nChapter 5: Human Error? No, Bad Design",
         "design, usability, human-computer interaction, psychology, user experience, product design"],
        
        // Mathematics - Enhanced with metadata
        ["Calculus: Early Transcendentals", "James Stewart", "9781285740621", "Mathematics", "Comprehensive calculus textbook with applications", "/uploads/math.jpg", "Cengage Learning", 2015,
         "Stewart's CALCULUS: EARLY TRANSCENDENTALS has the mathematical precision, accuracy, clarity of exposition and outstanding examples and problem sets that have made it the most widely used calculus textbook.",
         "Chapter 1: Functions and Models\nChapter 2: Limits and Derivatives\nChapter 3: Differentiation Rules\nChapter 4: Applications of Differentiation\nChapter 5: Integrals\nChapter 6: Applications of Integration",
         "calculus, mathematics, derivatives, integrals, limits, mathematical analysis"],
        
        ["Linear Algebra Done Right", "Sheldon Axler", "9783319110790", "Mathematics", "A modern approach to linear algebra", "/uploads/math.jpg", "Springer", 2015,
         "This text for a second course in linear algebra, aimed at math majors and graduate students, adopts a novel approach by banishing determinants to the end of the book and focusing on understanding the structure of linear operators on vector spaces.",
         "Chapter 1: Vector Spaces\nChapter 2: Finite-Dimensional Vector Spaces\nChapter 3: Linear Maps\nChapter 4: Polynomials\nChapter 5: Eigenvalues, Eigenvectors, and Invariant Subspaces",
         "linear algebra, vector spaces, matrices, eigenvalues, mathematical theory"],
        
        // History - Enhanced with metadata
        ["Sapiens: A Brief History of Humankind", "Yuval Noah Harari", "9780062316097", "History", "The story of how humans conquered the world", "/uploads/history.jpg", "Harper", 2014,
         "From a renowned historian comes a groundbreaking narrative of humanity's creation and evolution—a #1 international bestseller—that explores the ways in which biology and history have defined us and enhanced our understanding of what it means to be 'human.'",
         "Part One: The Cognitive Revolution\nChapter 1: An Animal of No Significance\nChapter 2: The Tree of Knowledge\nPart Two: The Agricultural Revolution\nChapter 5: History's Biggest Fraud\nPart Three: The Unification of Humankind",
         "anthropology, human evolution, civilization, cognitive revolution, agricultural revolution, history"],
        
        ["Guns, Germs, and Steel", "Jared Diamond", "9780393317558", "History", "The fates of human societies explained", "/uploads/history.jpg", "W. W. Norton", 1997,
         "In this groundbreaking work, evolutionary biologist Jared Diamond stunningly dismantles racially based theories of human history by revealing the environmental factors actually responsible for history's broadest patterns.",
         "Prologue: Yali's Question\nPart One: From Eden to Cajamarca\nChapter 1: Up to the Starting Line\nPart Two: The Rise and Spread of Food Production\nChapter 4: Farmer Power\nPart Three: From Food to Guns, Germs, and Steel",
         "world history, geography, environmental determinism, civilization, agriculture, technology"],
        
        // Literature - Enhanced with metadata
        ["Pride and Prejudice", "Jane Austen", "9780141199078", "Literature", "Classic romance novel of manners and marriage", "/uploads/literature.jpg", "Penguin Classics", 1813,
         "When Elizabeth Bennet meets Fitzwilliam Darcy, she believes he is the last man on earth she could ever marry. But as their lives become intertwined in unexpected ways, she finds herself captivated by the very person she swore to loathe.",
         "Chapter 1: It is a truth universally acknowledged...\nChapter 2: Mr. Bennet was among the earliest of those who waited on Mr. Bingley\nChapter 3: Not all that Mrs. Bennet, however, with the assistance of her five daughters\nChapter 4: When Jane and Elizabeth were alone",
         "romance, social commentary, marriage, class, 19th century literature, British literature"],
        
        ["The Lord of the Rings", "J.R.R. Tolkien", "9780261102385", "Literature", "Epic high fantasy adventure trilogy", "/uploads/literature.jpg", "HarperCollins", 1954,
         "In ancient times the Rings of Power were crafted by the Elven-smiths, and Sauron, the Dark Lord, forged the One Ring, filling it with his own power so that he could rule all others. But the One Ring was taken from him, and though he sought it throughout Middle-earth, it remained lost to him.",
         "Book I: The Ring Sets Out\nChapter 1: A Long-expected Party\nChapter 2: The Shadow of the Past\nBook II: The Ring Goes South\nChapter 1: Many Meetings\nBook III: The Treason of Isengard",
         "fantasy, adventure, mythology, good vs evil, heroism, friendship, epic literature"],
        
        ["1984", "George Orwell", "9780451524935", "Literature", "Dystopian novel about totalitarian surveillance", "/uploads/literature.jpg", "Signet Classics", 1949,
         "Among the seminal texts of the 20th century, Nineteen Eighty-Four is a rare work that grows more haunting as its futuristic purgatory becomes more real. Published in 1949, the book offers political satirist George Orwell's nightmare vision of a totalitarian, bureaucratic world.",
         "Part One\nChapter 1: It was a bright cold day in April, and the clocks were striking thirteen\nChapter 2: As he put his hand to the door-knob Winston saw that he had left the diary open\nPart Two\nChapter 1: It was the middle of the morning, and Winston had left the cubicle to go to the lavatory",
         "dystopia, totalitarianism, surveillance, political fiction, social criticism, thought control"]
      ];

      const stmt = db.prepare('INSERT INTO books (title, author, isbn, category, description, image, publisher, year, abstract, toc, subjects) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      samples.forEach(s => stmt.run(s));
      stmt.finalize(() => {
        console.log('Sample books seeded');
        // Backfill FTS
        db.run(`INSERT INTO books_fts(rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
                SELECT id, title, author, isbn, IFNULL(publisher,''), IFNULL(year,''), IFNULL(abstract,''), IFNULL(toc,''), IFNULL(subjects,''), IFNULL(category,'') FROM books`);
        db.close();
      });
      return;
    }
    console.log('Books already present, skipping seed.');
    db.close();
  });
});
