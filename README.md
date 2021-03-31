## gmail-unread-att-dl
GMail Unread Attachments Downloader -
A nodeJS script that bulk downloads attachments from unread emails (GMail) and marks them as read.

Steps to use it -

#### Step 1 - Enable up GMail API for your account
Follow this <a href="https://developers.google.com/gmail/api/quickstart/nodejs">guide</a> to set up the API

#### Step 2 - Setting up
Clone the repo
Run npm install

#### Step 3 - Copy credentials
Paste the credentials.json from the previous guide into the root directory

#### Step 4 - Generate token.json
Run the program and open the link from the command line to allow access.
A token.json file will be generated which will be used for auth in subsequent runs
