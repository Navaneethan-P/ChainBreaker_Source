<div align="center">
  <img src="logo.png" alt="ChainBreaker Logo" width="200" />
</div>

# ChainBreaker

ChainBreaker is an autonomous security sentinel designed to map how isolated vulnerabilities chain together into functional attack paths. By leveraging a local, encrypted, and open-source architecture, ChainBreaker provides security teams with deep visibility into exploitable attack chains without compromising source code privacy.

## Overview

Modern software ecosystems are highly interconnected. A low-severity vulnerability in an underlying module can easily escalate into a critical breach when chained with other seemingly benign configuration flaws. ChainBreaker utilizes advanced static analysis and AI-driven reasoning to automatically construct and validate these attack chains, presenting them in an interactive, visual graph.

### Key Capabilities

* **Automated Chain Construction**: Correlates findings from Semgrep, Bandit, pip-audit, and other SAST tools to form multi-step attack vectors.
* **Executive Risk Profiling**: Calculates financial risk exposure based on the Factor Analysis of Information Risk (FAIR) model and flags compliance violations (e.g., SOC2, ISO27001).
* **Automated Remediation**: Integrates with local or cloud-based LLM engines to generate precise, unified diff patches for identified vulnerabilities.
* **Attack Graph Visualization**: Provides an interactive, force-directed graph to visually trace compromised nodes and high-value target assets (Loot).

## Setup and Installation

### Prerequisites

* Python 3.10 or higher
* Node.js 18 or higher
* (Optional) Ollama for local, air-gapped AI reasoning

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   python main.py
   ```

### Frontend Setup

1. Navigate to the desktop directory:
   ```bash
   cd desktop
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev:vite
   ```

## Production Build

To build the frontend for production deployment:

```bash
cd desktop
npm run build:vite
```
The compiled static files will be available in the `desktop/dist` directory.

## License and Copyright

Copyright (c) 2026 Navaneethan P

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
