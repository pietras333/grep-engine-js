# Custom Regex Matcher (JavaScript)

This project implements a **custom regex engine** in JavaScript.  
It supports pattern matching with features such as:
- Start (`^`) and end (`$`) anchors  
- Character classes (`[abc]`, `[a-z]`, `[^a-z]`)  
- Common escapes (`\d`, `\w`, `\s`)  
- Grouping with `()` and alternation (`|`)  
- Quantifiers (`?`, `+`)  
- Backreferences (`\1`, `\2`, etc.)  

The program mimics simplified regex behavior without relying on JavaScript’s built-in `RegExp`.

---

## 🚀 Usage

### Run
```bash
node main.js -E "<pattern>" < input.txt
