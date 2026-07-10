# Run these 3 commands in PowerShell to push the complete Attack Chain Mapper to GitHub
# Replace YOUR_GITHUB_TOKEN with your actual token from https://github.com/settings/tokens

$token = "YOUR_GITHUB_TOKEN"
cd d:\Project\Forge
git remote set-url origin "https://$token@github.com/Navaneethan-P/Forge.git"
git push -u origin master
