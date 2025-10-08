# PowerShell script to deploy avatar-chat-folio to GitHub
Write-Host "Starting GitHub deployment process..." -ForegroundColor Green

# Set the project directory
$projectPath = "C:\Users\Zook\Downloads\avatar-chat-folio-main"
Set-Location $projectPath

Write-Host "Current directory: $projectPath" -ForegroundColor Yellow

# Initialize Git repository
Write-Host "Initializing Git repository..." -ForegroundColor Cyan
git init

# Create .gitignore file
Write-Host "Creating .gitignore file..." -ForegroundColor Cyan
@"
node_modules/
/dist
.env
.env.local
.DS_Store
*.log
.vscode/
"@ | Out-File -FilePath ".gitignore" -Encoding UTF8

# Add all files to Git
Write-Host "Adding all files to Git..." -ForegroundColor Cyan
git add .

# Commit the files
Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Initial commit: Avatar Chat Portfolio with 3D animations and AI chat"

# Get repository details
$repoName = Read-Host "Enter repository name (default: avatar-portfolio)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "avatar-portfolio"
}

$githubUsername = Read-Host "Enter GitHub username (default: zzthecoder)"
if ([string]::IsNullOrWhiteSpace($githubUsername)) {
    $githubUsername = "zzthecoder"
}

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Magenta
Write-Host "1. Go to https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name: $repoName" -ForegroundColor White
Write-Host "3. Make it PUBLIC" -ForegroundColor White
Write-Host "4. DO NOT check any initialization boxes" -ForegroundColor Red
Write-Host "5. Click 'Create repository'" -ForegroundColor White
Write-Host ""

$ready = Read-Host "Have you created the repository on GitHub? (y/n)"

if ($ready -eq "y" -or $ready -eq "Y") {
    $remoteUrl = "https://github.com/$githubUsername/$repoName.git"
    Write-Host "Adding remote origin: $remoteUrl" -ForegroundColor Cyan
    
    git remote add origin $remoteUrl
    git branch -M main
    
    Write-Host "Pushing to GitHub..." -ForegroundColor Green
    git push -u origin main
    
    Write-Host ""
    Write-Host "SUCCESS! Repository created at:" -ForegroundColor Green
    Write-Host "https://github.com/$githubUsername/$repoName" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Deploy to:" -ForegroundColor Magenta
    Write-Host "- Vercel: https://vercel.com" -ForegroundColor White
    Write-Host "- Netlify: https://netlify.com" -ForegroundColor White
} else {
    Write-Host "Run this script again after creating the GitHub repository." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host