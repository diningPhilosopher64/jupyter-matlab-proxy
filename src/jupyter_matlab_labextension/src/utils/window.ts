// Copyright 2025 The MathWorks, Inc.

interface PopupConfig {
    url: string;
    title: string;
    width: number;
    height: number;
  }

export default class PopupWindowManager {
    private popup: Window | null = null;
    private checkInterval: number | null = null;

    openPopup (config: PopupConfig): void {
        const {
            url,
            title,
            width,
            height
        } = config;

        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const features = [
            `width=${width}`,
            `height=${height}`,
            `left=${left}`,
            `top=${top}`,
            'toolbar=no',
            'location=no',
            'status=no',
            'menubar=no',
            'scrollbars=yes',
            'resizable=yes'
        ].join(',');

        this.popup = window.open('', title, features);

        if (!this.popup) {
            throw new Error('Failed to open popup. Please check if popup blocker is enabled.');
        }

        this.popup.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
              }
              iframe {
                border: none;
                width: 100%;
                height: 100%;
              }
            </style>
            <script>
              window.addEventListener('message', (event) => {
                window.opener.postMessage(event.data, '*');
              });
            </script>
          </head>
          <body>
            <iframe src="${url}" allow="popup"></iframe>
          </body>
        </html>
      `);
        this.popup.document.close();

        // Monitor popup state
        this.checkInterval = window.setInterval(() => {
            if (this.popup?.closed) {
                this.cleanup();
            }
        }, 500);
    }

    closePopup (): void {
        if (this.popup) {
            this.popup.close();
            this.cleanup();
        }
    }

    private cleanup (): void {
        if (this.checkInterval) {
            window.clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.popup = null;
    }

    destroy (): void {
        this.closePopup();
    }
}
