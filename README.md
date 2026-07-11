<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" />
</div>

<h1 align="center">Attack Chain Mapper</h1>

<p align="center">
  <strong>Autonomous Security Sentinel & Historical Breach Engine</strong><br/>
  <i>Visualize, map, and remediate attack chains before they are exploited.</i>
</p>

---

##  What is Attack Chain Mapper?

Attack Chain Mapper is an autonomous desktop application that scans your repositories for vulnerabilities, maps their data flows, and uses AI to reason exactly how an attacker would chain them together. 

Instead of overwhelming you with a list of isolated warnings, it builds a **Cyber Command Graph** showing the exact blast radius and path of attack.

### Core Features
- **Historical Breach Engine**: Correlates your attack chains against real-world catastrophic breaches (SolarWinds, Equifax, Log4Shell, Capital One).
- **Cyber Command Graph**: Deep-space dark theme with animated pulsing attack paths and blinking red halos on vulnerable nodes.
- **Supply Chain Risk Detection**: Automatically flags unpinned dependencies, missing lockfiles, and dangerous install scripts.
- **MITRE ATT&CK Mapping**: Every step in the attack chain is mapped to a real MITRE tactic.
- **Fix-It AI**: Interactive chat side-panel allowing you to converse with the AI to fix specific vulnerabilities.
- **Flexible AI Inference**: Run 100% locally with zero data egress (Ollama), or connect to high-performance Cloud APIs (Claude, Gemini, OpenAI).

---

##  Installation (Windows)

Attack Chain Mapper is distributed as a compiled executable. 

1. **Download the Installer**  
   Go to the [Releases](https://github.com/Navaneethan-P/Forge/releases) page and download `Attack Chain Mapper Setup X.X.X.exe`.

2. **Run the Installer**  
   Double-click the `.exe` to install the application.

3. **Complete the AI Setup Wizard**  
   On first launch, the application will guide you through setting up the AI engine. You can choose:
   - **Private Local AI (Recommended)**: The application provides a one-click PowerShell script to automatically install Ollama and the required AI model to your machine.
   - **Cloud API (High Performance)**: If you prefer, simply enter an API key for Anthropic Claude, Google Gemini, or OpenAI GPT.

---

##  Privacy & Security

If you choose the **Private Local AI** mode, Attack Chain Mapper runs completely offline. Your source code and vulnerabilities are analyzed entirely on your own machine. No data is ever transmitted externally.

If you choose a **Cloud API**, your source code and vulnerability data are sent to the provider you select using the API key you provide. Your API keys are encrypted locally using an AES-256-GCM vault and are never stored in plaintext.

---

##  License

This software is provided for free use under the MIT License.
