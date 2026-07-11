# 🛡️ Attack Chain Mapper

**Attack Chain Mapper** is a next-generation, local-first security tool that maps standalone vulnerabilities (like CVEs and Supply Chain Risks) into realistic, multi-step attack chains. Powered by local LLMs, it provides context-aware threat modeling without ever sending your sensitive codebase data to the cloud.

---

## 🌟 Key Features
- **Local AI Analysis**: Uses `Ollama` running entirely on your machine. Your code never leaves your device.
- **MITRE ATT&CK Mapping**: Automatically maps theoretical attacks to recognized MITRE tactics (e.g., *Initial Access*, *Persistence*, *Exfiltration*).
- **Supply Chain Risk Scoring**: Looks beyond CVEs to identify missing lockfiles, unpinned dependencies, and risky npm install scripts.
- **Fix-It AI Assistant**: An interactive chat panel that helps you remediate vulnerabilities and patch attack vectors in real-time.

---

## 🚀 Installation & Usage (End Users)

The easiest way to run Attack Chain Mapper is by using the standalone Windows installer.

### Prerequisites (Important!)
Because this tool relies on local AI inference and Python-based analysis, you must have the following installed on your system before running:
1. **[Python 3.10+](https://www.python.org/downloads/)**: Ensure you check the box that says "Add Python to PATH" during installation.
2. **[Ollama](https://ollama.com/)**: Download and install Ollama for local LLM support.
   - After installing, open a terminal and run: `ollama run llama3` to download the required AI model.

### Running the App
1. Navigate to the `desktop/dist-app/` directory (or download from the latest GitHub Release).
2. Run `Attack Chain Mapper Setup 1.0.0.exe`.
3. The app will install and create a desktop shortcut.
4. On the first launch, it will verify your environment (Python, Ollama) and automatically pull down required scanning tools (Semgrep, pip-audit).

---

## 🛠️ Developer Setup (Building from Source)

If you want to contribute or build the application from source, follow these steps:

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- Ollama (running locally with the `llama3` model)

### 1. Backend Setup
1. Open a terminal in the `backend/` directory.
2. Create a virtual environment (optional but recommended): `python -m venv venv`
3. Activate the environment:
   - Windows: `.\venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install requirements: `pip install -r requirements.txt`
5. Start the backend: `uvicorn main:app --port 8000 --reload`

### 2. Frontend Setup
1. Open a new terminal in the `desktop/` directory.
2. Install dependencies: `npm install`
3. Start the dev server and Electron shell concurrently: `npm run dev`

### 3. Packaging
To build the `.exe` installer yourself:
```bash
cd desktop
npm run build:win
```
The output installer will be generated in `desktop/dist-app/`.

---

## ⚠️ Troubleshooting

**Q: The app opens but I get a "Connection Refused" error for the backend.**
A: Ensure your local Python environment is correctly set up. If running from source, make sure `uvicorn` is running on port `8000`.

**Q: The AI takes forever to generate attack chains, or fails entirely.**
A: This usually means Ollama is not running in the background, or you haven't pulled the `llama3` model. Open a terminal and run `ollama serve` and/or `ollama run llama3`.

**Q: The scanner hangs on Python projects.**
A: Attack Chain Mapper uses `pip-audit`. Ensure you have an active internet connection so the tool can query PyPI for vulnerability data.

---

## 📜 License
MIT License. See `LICENSE` for more information.
