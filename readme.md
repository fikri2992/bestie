
# Unpublished Chrome Extension



This is an unpublished Chrome extension project. This README provides instructions on how to set up, install, and run the extension locally for development and testing purposes.



# Table of Contents



- [Prerequisites](#prerequisites)

- [Installation](#installation)

- [Loading the Extension](#loading-the-extension)

- [Usage](#usage)

- [File Structure](#file-structure)

- [Key Files](#key-files)

- [Running in Development Mode](#running-in-development-mode)

- [Contributing](#contributing)

- [License](#license)



# Prerequisites



-  **Google Chrome** browser installed on your computer.

- (Optional) **Node.js** and **npm** if you plan to manage dependencies or use build tools.

- **Bestie API**: You need to clone and run the [bestie-api](https://github.com/fikri2992/bestie-api) for the extension to function properly.


# Installation


1.  ### **Clone or download** this repository to your local machine.

```bash

git  clone  https://github.com/fikri2992/bestie.git

```

2. ### **Loading the Extension**

Open Google Chrome and navigate to **chrome://extensions/**



Enable Developer Mode by toggling the switch in the top right corner.

  ![enable developer mode on chrome extension](https://i.imgur.com/2sDnVX1.png)

Click on the "Load unpacked" button.

  ![load unpacked](https://i.imgur.com/N9v9DOR.png)

Select the directory where you cloned or downloaded this project.

3. ### **Usage**
to open extension you can just start click on the Bestie Icon on your extensions menu in top right corner 
- you can start enabling by pressing **Ctrl + Shift + E** 
- you can start open chat UI by pressing **Ctrl + Shift + Y**
- open a webpage with image and you will see image blurred, you can press **Ctrl+Shift+S** to reveal blurred image
- you also can re-blur image by pressing **Ctrl+Shift+Q**

4. ### File Structure

-   `manifest.json`: Defines the extension's properties and permissions.
-   `popup.html`: The HTML file for the extension's popup UI.
-   `popup.js`: Contains the JavaScript code for the popup's functionality.
-   `popup.css`: CSS styles for the popup UI.
-   `background.js`: Contains background scripts for persistent tasks.
-   `content.js/`: Contain script that will be injected to client webpages.

# Lisence
This project is licensed under the [MIT License](https://mit-license.org/).