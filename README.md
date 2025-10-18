# Mathematics Library

A personal, browser-based library for organizing and viewing your collection of mathematics PDF books. This is a self-contained, static web application that runs entirely in your browser, making it easy to host on services like GitHub Pages or run locally.

It uses a `books.json` manifest for its data, which can be generated automatically from your directory structure using the provided Python script.

 <!--- Placeholder for a screenshot -->

## ✨ Features

*   **Static & Serverless:** No backend required. Runs directly in the browser and can be hosted on any static web host.
*   **Fuzzy Search:** Quickly find books by title, author, field, or tags with powerful fuzzy search powered by Fuse.js.
*   **Filtering & Sorting:** Filter your library by field (e.g., "Real Analysis") or tags. Sort by title, author, file size, and more.
*   **In-Browser PDF Viewer:** View PDFs directly in the app, with controls for pagination and zoom (powered by PDF.js).
*   **Metadata Editing:** Edit book titles, authors, tags, and descriptions directly from the UI.
*   **Data Portability:** Import and export your entire library's metadata as a single `books.json` file.
*   **Automatic Manifest Generation:** A Python script is included to scan your book directories and generate the `books.json` manifest automatically.
*   **Responsive Design:** Works on desktop, tablet, and mobile devices.

## 🚀 Getting Started

Follow these steps to set up your personal library.

### 1. Structure Your Books

Organize your PDF files into a root folder (the default is `Books`). Use subdirectories for different fields of mathematics. The script uses these subdirectory names as the "field" for each book.

```
/
├── Books/
│   ├── Real Analysis/
│   │   ├── Rudin - Principles of Mathematical Analysis [analysis, classic].pdf
│   │   └── Tao - An Introduction to Measure Theory.pdf
│   ├── Linear Algebra/
│   │   └── Axler - Linear Algebra Done Right [algebra, undergraduate].pdf
│   └── ...
├── index.html
├── app.js
├── styles.css
└── generate_manifest.py
```

### 2. Name Your Files

For the best results with the generation script, name your PDF files using the following convention:

`Author Name - Book Title [tag1, tag2, ...].pdf`

*   The author and title should be separated by ` - `.
*   Tags are optional and should be placed in square brackets `[]` at the end of the filename, separated by commas.

### 3. Generate the `books.json` Manifest

Run the provided Python script from the root of your project to scan your book directory and create the `books.json` file.

```bash
# Make sure you have Python 3 installed
python3 generate_manifest.py
```

This will create a `books.json` file in your project's root directory.

### 4. Run the Application

Since this is a static website, you can't just open `index.html` from your file system due to browser security policies (CORS). You need to serve it using a local web server.

A simple way is to use Python's built-in HTTP server:

```bash
# From your project's root directory
python3 -m http.server
```

Now, open your web browser and navigate to `http://localhost:8000`.

### 5. Using the Library

1.  **Scan Books:** The first time you load the app, click the `🔄 Scan Books` button. This will load the `books.json` manifest into the application and save it to your browser's local storage.
2.  **Browse:** Your books will appear in the grid. You can now search, filter, and sort them.
3.  **Edit & Save:** If you make changes to any book's metadata, your changes are saved in the browser. To persist these changes, go to `⚙️ Configure` -> `Data Management` and click `📤 Export Library Data`. This will download an updated `books.json` file.
4.  **Update Your Library:** Replace the old `books.json` with the new one you just downloaded. If you are using version control (like Git), this is the file you'll want to commit to save your metadata changes.

## 🔧 Configuration

Click the `⚙️ Configure` button to access settings:

*   **Directory Structure:** Change the name of the root folder for your books.
*   **Search Settings:** Enable/disable fuzzy search and adjust its sensitivity.
*   **PDF Viewer:** Set a maximum file size for opening PDFs in the in-browser viewer. Larger files will open in a new tab instead.
*   **Data Management:** Export your current library data or import an existing `books.json` file.

## 💻 Tech Stack

*   **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
*   **Search:** Fuse.js
*   **PDF Rendering:** PDF.js
*   **Manifest Generation:** Python 3

