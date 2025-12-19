// Auto-sync function to add at the end of server.js

// Automatic sync function to ensure all borrowed books are in history
async function autoSyncHistory() {
  try {
    const borrowed = await all(`
      SELECT bb.*, b.title, b.author, b.isbn, u.username
      FROM borrowed_books bb
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN users u ON bb.user_id = u.id
    `);
    
    let synced = 0;
    for (const book of borrowed) {
      // Check if already in history
      const existing = await get(`
        SELECT id FROM borrow_history 
        WHERE book_id = ? AND user_id = ? AND status = 'borrowed'
        ORDER BY issue_date DESC LIMIT 1
      `, [book.book_id, book.user_id]);
      
      if (!existing) {
        // Add to history
        await run(`INSERT INTO borrow_history 
          (book_id, user_id, username, book_title, book_author, book_isbn, 
           issue_date, due_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?, '+14 days'), 'borrowed')`,
          [book.book_id, book.user_id, book.username, book.title, 
           book.author, book.isbn, book.borrow_date, book.borrow_date]);
        synced++;
        console.log(`🔄 Auto-synced: Book ${book.book_id} - ${book.title}`);
      }
    }
    
    if (synced > 0) {
      console.log(`✅ Auto-sync completed: ${synced} records added to history`);
    }
  } catch (error) {
    console.error('❌ Auto-sync error:', error);
  }
}

// Run auto-sync every 10 seconds
setInterval(autoSyncHistory, 10000);

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('🔄 Auto-sync enabled: History syncs every 10 seconds');
  // Run initial sync
  autoSyncHistory();
});
