const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const downloadsDir = path.join(rootDir, 'public', 'downloads');
const stagingZip = path.join(downloadsDir, 'BlastBee-Laptop-App.zip');
const outputExe = path.join(downloadsDir, 'BlastBee-Laptop-Setup.exe');

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Check if zip payload exists, if not run package-laptop first
if (!fs.existsSync(stagingZip)) {
  console.log('Generating base payload first...');
  require('./package-laptop');
}

console.log('🔨 Compiling BlastBee-Laptop-Setup.exe via csc.exe...');

const csCode = `
using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;

namespace BlastBeeInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                // Target installation directory: %LOCALAPPDATA%\\\\BlastBee
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(localAppData, "BlastBee");

                if (!Directory.Exists(installDir))
                {
                    Directory.CreateDirectory(installDir);
                }

                // Extract embedded resource payload
                Assembly asm = Assembly.GetExecutingAssembly();
                string resourceName = "BlastBeePayload";
                
                string tempZip = Path.Combine(Path.GetTempPath(), "BlastBee-Setup-" + Guid.NewGuid().ToString("N") + ".zip");

                using (Stream stream = asm.GetManifestResourceStream(resourceName))
                {
                    if (stream == null)
                    {
                        MessageBox.Show("Installation resource not found.", "BlastBee Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        return;
                    }
                    using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                    {
                        stream.CopyTo(fs);
                    }
                }

                // Extract files to installDir (overwrite existing)
                using (ZipArchive archive = ZipFile.OpenRead(tempZip))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        string destinationPath = Path.Combine(installDir, entry.FullName);
                        string destinationDir = Path.GetDirectoryName(destinationPath);
                        if (!string.IsNullOrEmpty(destinationDir) && !Directory.Exists(destinationDir))
                        {
                            Directory.CreateDirectory(destinationDir);
                        }

                        if (!string.IsNullOrEmpty(entry.Name))
                        {
                            entry.ExtractToFile(destinationPath, true);
                        }
                    }
                }

                try { File.Delete(tempZip); } catch {}

                // Create Desktop Shortcut via VBScript
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopPath, "BlastBee Email Engine.lnk");
                string targetPath = Path.Combine(installDir, "BlastBee.bat");

                string vbsScript = 
                    "Set oWS = WScript.CreateObject(\\"WScript.Shell\\")\\r\\n" +
                    "sLinkFile = \\"" + shortcutPath.Replace("\\\\", "\\\\\\\\") + "\\"\\r\\n" +
                    "Set oLink = oWS.CreateShortcut(sLinkFile)\\r\\n" +
                    "oLink.TargetPath = \\"" + targetPath.Replace("\\\\", "\\\\\\\\") + "\\"\\r\\n" +
                    "oLink.WorkingDirectory = \\"" + installDir.Replace("\\\\", "\\\\\\\\") + "\\"\\r\\n" +
                    "oLink.Description = \\"BlastBee Email Engine Laptop App\\"\\r\\n" +
                    "oLink.WindowStyle = 7\\r\\n" +
                    "oLink.Save\\r\\n";

                string tempVbs = Path.Combine(Path.GetTempPath(), "mkshortcut-" + Guid.NewGuid().ToString("N") + ".vbs");
                File.WriteAllText(tempVbs, vbsScript);
                try {
                    Process p = Process.Start("wscript.exe", "\\"" + tempVbs + "\\"");
                    p.WaitForExit(3000);
                    File.Delete(tempVbs);
                } catch {}

                // Success Message & Auto Launch Option
                DialogResult dr = MessageBox.Show(
                    "BlastBee Email Engine has been successfully installed on your laptop!\\n\\n" +
                    "• Installed to: " + installDir + "\\n" +
                    "• Desktop shortcut added: BlastBee Email Engine\\n\\n" +
                    "Would you like to launch BlastBee Laptop App now?",
                    "BlastBee Laptop App Setup Complete",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information
                );

                if (dr == DialogResult.Yes)
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = targetPath;
                    psi.WorkingDirectory = installDir;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Installation note:\\n" + ex.Message, "BlastBee Setup", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}
`;

const csFile = path.join(rootDir, 'BlastBeeSetup.cs');
fs.writeFileSync(csFile, csCode, 'utf8');

try {
  const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
  const cmd = `"${cscPath}" /target:winexe /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /res:"${stagingZip}",BlastBeePayload /out:"${outputExe}" "${csFile}"`;
  
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✅ Success! Created standalone installer: ${outputExe}`);
  
  const stats = fs.statSync(outputExe);
  console.log(`   File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
} catch (err) {
  console.error('Compilation failed:', err);
} finally {
  if (fs.existsSync(csFile)) {
    fs.unlinkSync(csFile);
  }
}
