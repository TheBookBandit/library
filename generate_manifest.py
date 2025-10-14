#!/usr/bin/env python3
import os
import json
from pathlib import Path
import time

def parse_filename(filename):
    """Parse filename to extract metadata"""
    base = filename.replace('.pdf', '')
    
    # Extract tags [tag1, tag2]
    tags = []
    if '[' in base and ']' in base:
        tag_start = base.rfind('[')
        tag_end = base.rfind(']')
        tags = [t.strip() for t in base[tag_start+1:tag_end].split(',')]
        base = base[:tag_start].strip()
    
    # Extract author and title (Author - Title format)
    if ' - ' in base:
        parts = base.split(' - ', 1)
        author = parts[0].strip()
        title = parts[1].strip()
    else:
        author = ""
        title = base.strip()
    
    return title, author, tags

def generate_books_json(root_folder='Books', output='books.json'):
    books = []
    book_id = 1
    
    # Walk through the Books directory
    for root, dirs, files in os.walk(root_folder):
        for file in files:
            if file.lower().endswith('.pdf'):
                # Get full path
                full_path = os.path.join(root, file)
                relative_path = full_path.replace('\\', '/')
                
                # Get field from parent directory
                field = Path(root).name if Path(root).name != root_folder else "Uncategorized"
                
                # Get file size
                size_bytes = os.path.getsize(full_path)
                
                # Parse filename
                title, author, tags = parse_filename(file)
                
                # Create book entry
                book = {
                    "id": str(book_id),
                    "title": title,
                    "author": author,
                    "field": field,
                    "tags": tags,
                    "description": "",
                    "path": relative_path,
                    "sizeBytes": size_bytes,
                    "addedAt": int(time.time() * 1000),
                    "metadataSource": "filename"
                }
                
                books.append(book)
                book_id += 1
                print(f"Added: {title} ({field})")
    
    # Write to JSON file
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(books, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Generated {output} with {len(books)} books")

if __name__ == '__main__':
    generate_books_json()
