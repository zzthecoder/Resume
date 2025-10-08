# PowerShell script to deploy avatar-chat-folio to a new GitHub repository
# Run this script from the project directory

Write-Host "Starting GitHub deployment process..." -ForegroundColor Green

# Set the project directory
$projectPath = "C:\Users\Zook\Downloads\avatar-chat-folio-main"
Set-Location $projectPath

Write-Host "Current directory: $projectPath" -ForegroundColor Yellow

# Initialize Git repository if not already initialized
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..." -ForegroundColor Cyan
    git init
} else {
    Write-Host "Git repository already initialized" -ForegroundColor Green
}

# Create .gitignore if it doesn't exist
if (-not (Test-Path ".gitignore")) {
    Write-Host "Creating .gitignore file..." -ForegroundColor Cyan
    $gitignoreContent = @"
# Dependencies
node_modules/
/.pnp
.pnp.js

# Production build
/dist
/build

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
Thumbs.db
.DS_Store

# Temporary files
*.tmp
*.temp
"@
    $gitignoreContent | Out-File -FilePath ".gitignore" -Encoding UTF8
}

# Add all files to Git
Write-Host "Adding all files to Git..." -ForegroundColor Cyan
git add .

# Commit the files
Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Initial commit: Avatar Chat Portfolio with 3D animations and AI chat"

# Prompt user for repository name
$repoName = Read-Host "Enter your desired repository name (e.g., avatar-chat-portfolio)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "avatar-chat-portfolio"
    Write-Host "Using default name: $repoName" -ForegroundColor Yellow
}

# Prompt for GitHub username
$githubUsername = Read-Host "Enter your GitHub username (default: zzthecoder)"
if ([string]::IsNullOrWhiteSpace($githubUsername)) {
    $githubUsername = "zzthecoder"
    Write-Host "Using default username: $githubUsername" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Magenta
Write-Host "1. Go to https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name: $repoName" -ForegroundColor White
Write-Host "3. Make it Public" -ForegroundColor White
Write-Host "4. DO NOT initialize with README, .gitignore, or license" -ForegroundColor Red
Write-Host "5. Click Create repository" -ForegroundColor White

$continue = Read-Host "Have you created the GitHub repository? (y/n)"
if ($continue -eq "y" -or $continue -eq "Y") {
    # Set the remote origin
    $remoteUrl = "https://github.com/$githubUsername/$repoName.git"
    Write-Host "Adding remote origin: $remoteUrl" -ForegroundColor Cyan
    
    # Remove existing remote if it exists
    git remote remove origin 2>$null
    git remote add origin $remoteUrl
    
    # Set the main branch
    Write-Host "Setting up main branch..." -ForegroundColor Cyan
    git branch -M main
    
    # Push to GitHub
    Write-Host "Pushing to GitHub..." -ForegroundColor Green
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS! Your portfolio has been deployed to GitHub!" -ForegroundColor Green
        Write-Host "Repository URL: https://github.com/$githubUsername/$repoName" -ForegroundColor Cyan
        
        Write-Host ""
        Write-Host "Ready for deployment platforms:" -ForegroundColor Magenta
        Write-Host "• Vercel: https://vercel.com (Recommended)" -ForegroundColor White
        Write-Host "• Netlify: https://netlify.com" -ForegroundColor White
        Write-Host "• GitHub Pages: Enable in repo Settings > Pages" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "Error occurred during push. Check your credentials and try again." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "Process paused. Run this script again after creating the GitHub repository." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Summary of what was done:" -ForegroundColor Blue
Write-Host "✓ Initialized Git repository" -ForegroundColor Green
Write-Host "✓ Created .gitignore file" -ForegroundColor Green
Write-Host "✓ Added all project files" -ForegroundColor Green
Write-Host "✓ Created initial commit" -ForegroundColor Green
if ($continue -eq "y" -or $continue -eq "Y") {
    Write-Host "✓ Pushed to GitHub repository" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")