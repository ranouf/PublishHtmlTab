import {
  INTERNAL_REPORT_HEIGHT_MESSAGE,
  INTERNAL_REPORT_LINK_ATTRIBUTE,
  INTERNAL_REPORT_MISSING_LINK_ATTRIBUTE,
  INTERNAL_REPORT_NAVIGATION_MESSAGE,
} from '../../constants';
import { ReportManifest, ReportManifestEntry } from '../../models';
import { wrapHtmlInReportFrame } from '../../utils/html';
import {
  findManifestEntryByAttachmentName,
  getManifestEntries,
  getReportDirectory,
  getReportPath,
} from '../../utils/reportManifest';
import {
  createInternalReportHash,
  isExternalUrl,
  normalizeReportPath,
  resolveRelativeReportPath,
} from '../../utils/reportPaths';
import { AttachmentClient } from '../attachments/AttachmentClient';

/**
 * Rewrites published report HTML so it behaves correctly inside the extension frame.
 */
export class ReportHtmlService {
  private readonly attachmentClient: AttachmentClient;
  private readonly linkedAssetContentCache = new Map<string, Promise<string>>();
  private readonly scriptBlobUrlCache = new Map<string, Promise<string>>();
  private readonly createdObjectUrls = new Set<string>();

  /**
   * Creates a report HTML service bound to a specific attachment provider.
   *
   * @param {AttachmentClient} attachmentClient - Attachment provider used to download report assets.
   */
  constructor(attachmentClient: AttachmentClient) {
    this.attachmentClient = attachmentClient;
  }

  /**
   * Releases blob URLs and caches created while rewriting reports.
   *
   * @returns {void} Does not return a value.
   */
  public dispose(): void {
    // Clean up generated blob URLs when the feature goes away.
    this.createdObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.createdObjectUrls.clear();
    this.scriptBlobUrlCache.clear();
    this.linkedAssetContentCache.clear();
  }

  /**
   * Returns the final iframe HTML for a selected report attachment.
   *
   * @param {string} attachmentName - Report attachment name to render.
   * @param {ReportManifest} [manifest] - Optional manifest used to rewrite linked assets.
   * @returns {Promise<string>} HTML string ready to inject into `srcdoc`.
   * @throws {Error} Throws when the report or one of its linked assets cannot be resolved.
   */
  public async getReportFrameHtml(
    attachmentName: string,
    manifest?: ReportManifest,
  ): Promise<string> {
    if (!manifest) {
      // Legacy mode can render the HTML attachment without any rewrite step.
      const rawHtml =
        await this.attachmentClient.getReportContent(attachmentName);
      return wrapHtmlInReportFrame(rawHtml, attachmentName);
    }

    const reportEntry = findManifestEntryByAttachmentName(
      manifest,
      attachmentName,
    );
    if (!reportEntry) {
      throw new Error(`Report ${attachmentName} was not found in the manifest`);
    }

    const html = await this.attachmentClient.getReportContent(attachmentName);
    const rewrittenHtml = await this.rewriteReportHtml(
      html,
      reportEntry,
      manifest,
    );
    return wrapHtmlInReportFrame(rewrittenHtml, attachmentName);
  }

  /**
   * Rewrites one report document so all relative links work inside the extension.
   *
   * @param {string} html - Raw HTML downloaded from the report attachment.
   * @param {ReportManifestEntry} reportEntry - Manifest entry for the current report.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @returns {Promise<string>} Rewritten report document HTML.
   */
  private async rewriteReportHtml(
    html: string,
    reportEntry: ReportManifestEntry,
    manifest: ReportManifest,
  ): Promise<string> {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');
    const assetUrlsByPath = this.buildAssetUrlMap(manifest);
    await this.rewriteReportDocument(
      document,
      reportEntry,
      manifest,
      assetUrlsByPath,
    );
    this.injectFrameLayoutStyles(document);
    this.injectNavigationScript(document, reportEntry.attachmentName);

    return document.documentElement.outerHTML;
  }

  /**
   * Applies all URL and asset rewrites required by an embedded report document.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {ReportManifestEntry} reportEntry - Manifest entry for the current report.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {Promise<void>} Resolves when document rewrites are complete.
   */
  private async rewriteReportDocument(
    document: Document,
    reportEntry: ReportManifestEntry,
    manifest: ReportManifest,
    assetUrlsByPath: Map<string, string>,
  ): Promise<void> {
    const reportDirectory = getReportDirectory(reportEntry);

    await this.inlineLinkedAssets(
      document,
      reportDirectory,
      manifest,
      assetUrlsByPath,
    );
    this.rewriteAnchorUrls(
      document,
      reportDirectory,
      manifest,
      assetUrlsByPath,
    );
    this.rewriteEmbeddedAssetUrls(document, reportDirectory, assetUrlsByPath);
    this.rewriteInlineStyles(document, reportDirectory, assetUrlsByPath);
  }

  /**
   * Rewrites media and embedded element URLs to downloadable attachment URLs.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {void} Does not return a value.
   */
  private rewriteEmbeddedAssetUrls(
    document: Document,
    reportDirectory: string,
    assetUrlsByPath: Map<string, string>,
  ): void {
    [
      ['img', 'src'],
      ['iframe', 'src'],
      ['source', 'src'],
    ].forEach(([selector, attributeName]) => {
      this.rewriteElementUrls(
        document,
        selector,
        attributeName,
        reportDirectory,
        assetUrlsByPath,
      );
    });
  }

  /**
   * Inlines linked stylesheets and rewrites script URLs to blob URLs.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {Promise<void>} Resolves when linked assets are rewritten.
   */
  private async inlineLinkedAssets(
    document: Document,
    reportDirectory: string,
    manifest: ReportManifest,
    assetUrlsByPath: Map<string, string>,
  ): Promise<void> {
    await Promise.all([
      this.inlineLinkedStylesheets(
        document,
        reportDirectory,
        manifest,
        assetUrlsByPath,
      ),
      this.rewriteLinkedScripts(document, reportDirectory, manifest),
    ]);
  }

  /**
   * Inlines linked stylesheets so nested relative URLs can be rewritten.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {Promise<void>} Resolves when stylesheet links have been inlined.
   */
  private async inlineLinkedStylesheets(
    document: Document,
    reportDirectory: string,
    manifest: ReportManifest,
    assetUrlsByPath: Map<string, string>,
  ): Promise<void> {
    const stylesheetLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        "link[rel='stylesheet'][href]",
      ),
    );

    await Promise.all(
      stylesheetLinks.map((linkElement) =>
        this.inlineLinkedStylesheet(
          document,
          linkElement,
          reportDirectory,
          manifest,
          assetUrlsByPath,
        ),
      ),
    );
  }

  /**
   * Rewrites linked script tags to blob URLs that are safe inside `srcdoc`.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @returns {Promise<void>} Resolves when script links have been rewritten.
   */
  private async rewriteLinkedScripts(
    document: Document,
    reportDirectory: string,
    manifest: ReportManifest,
  ): Promise<void> {
    const scriptLinks = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[src]'),
    );

    await Promise.all(
      scriptLinks.map((scriptElement) =>
        this.rewriteLinkedScript(scriptElement, reportDirectory, manifest),
      ),
    );
  }

  /**
   * Inlines one linked stylesheet and rewrites its nested asset URLs.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {HTMLLinkElement} linkElement - Stylesheet link to inline.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {Promise<void>} Resolves when the stylesheet has been inlined.
   */
  private async inlineLinkedStylesheet(
    document: Document,
    linkElement: HTMLLinkElement,
    reportDirectory: string,
    manifest: ReportManifest,
    assetUrlsByPath: Map<string, string>,
  ): Promise<void> {
    const href = linkElement.getAttribute('href');
    if (!href || isExternalUrl(href)) {
      return;
    }

    const linkedEntry = this.findManifestEntryForRelativeUrl(
      manifest,
      reportDirectory,
      href,
    );
    if (!linkedEntry) {
      return;
    }

    const stylesheetContent = await this.getCachedAttachmentContent(
      linkedEntry.attachmentName,
    );
    const styleElement = document.createElement('style');
    styleElement.textContent = this.rewriteCssUrls(
      stylesheetContent,
      getReportDirectory(linkedEntry),
      assetUrlsByPath,
    );
    linkElement.replaceWith(styleElement);
  }

  /**
   * Rewrites one linked script tag to a blob URL that can run inside `srcdoc`.
   *
   * @param {HTMLScriptElement} scriptElement - Script element whose `src` should be rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @returns {Promise<void>} Resolves when the script source has been rewritten.
   */
  private async rewriteLinkedScript(
    scriptElement: HTMLScriptElement,
    reportDirectory: string,
    manifest: ReportManifest,
  ): Promise<void> {
    const src = scriptElement.getAttribute('src');
    if (!src || isExternalUrl(src)) {
      return;
    }

    const linkedEntry = this.findManifestEntryForRelativeUrl(
      manifest,
      reportDirectory,
      src,
    );
    if (!linkedEntry) {
      return;
    }

    const blobScriptUrl = await this.getCachedScriptBlobUrl(
      linkedEntry.attachmentName,
    );
    scriptElement.setAttribute('src', blobScriptUrl);
  }

  /**
   * Rewrites anchor tags so internal report links stay inside the extension.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {void} Does not return a value.
   */
  private rewriteAnchorUrls(
    document: Document,
    reportDirectory: string,
    manifest: ReportManifest,
    assetUrlsByPath: Map<string, string>,
  ): void {
    document
      .querySelectorAll('a[href]')
      .forEach((element) =>
        this.rewriteAnchorElement(
          element,
          reportDirectory,
          manifest,
          assetUrlsByPath,
        ),
      );
  }

  /**
   * Rewrites one anchor element to either an internal report hash or a downloadable URL.
   *
   * @param {Element} element - Anchor element being rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {void} Does not return a value.
   */
  private rewriteAnchorElement(
    element: Element,
    reportDirectory: string,
    manifest: ReportManifest,
    assetUrlsByPath: Map<string, string>,
  ): void {
    const currentValue = element.getAttribute('href');
    if (!currentValue || isExternalUrl(currentValue)) {
      return;
    }

    const linkedEntry = this.findManifestEntryForRelativeUrl(
      manifest,
      reportDirectory,
      currentValue,
    );
    if (linkedEntry?.isHtml) {
      this.rewriteInternalReportAnchor(element, linkedEntry.attachmentName);
      return;
    }

    const resolvedPath = resolveRelativeReportPath(
      reportDirectory,
      currentValue,
    );
    const resolvedUrl = assetUrlsByPath.get(resolvedPath);
    if (resolvedUrl) {
      this.rewriteResolvedAnchor(element, resolvedUrl);
      return;
    }

    this.markMissingAnchorTarget(element, resolvedPath);
  }

  /**
   * Rewrites an anchor that points to another HTML report page in the manifest.
   *
   * @param {Element} element - Anchor element being rewritten.
   * @param {string} attachmentName - Attachment name of the linked report page.
   * @returns {void} Does not return a value.
   */
  private rewriteInternalReportAnchor(
    element: Element,
    attachmentName: string,
  ): void {
    element.setAttribute('href', createInternalReportHash(attachmentName));
    element.setAttribute(INTERNAL_REPORT_LINK_ATTRIBUTE, attachmentName);
    element.removeAttribute('target');
  }

  /**
   * Rewrites an anchor that points to a downloadable attachment asset.
   *
   * @param {Element} element - Anchor element being rewritten.
   * @param {string} resolvedUrl - Download URL resolved from the manifest.
   * @returns {void} Does not return a value.
   */
  private rewriteResolvedAnchor(element: Element, resolvedUrl: string): void {
    element.setAttribute('href', resolvedUrl);
    element.removeAttribute(INTERNAL_REPORT_MISSING_LINK_ATTRIBUTE);
  }

  /**
   * Marks an anchor as missing so the embedded host can show a not-found state.
   *
   * @param {Element} element - Anchor element being rewritten.
   * @param {string} resolvedPath - Normalized path that could not be resolved.
   * @returns {void} Does not return a value.
   */
  private markMissingAnchorTarget(
    element: Element,
    resolvedPath: string,
  ): void {
    element.setAttribute('href', '#');
    element.setAttribute(INTERNAL_REPORT_MISSING_LINK_ATTRIBUTE, resolvedPath);
    element.removeAttribute(INTERNAL_REPORT_LINK_ATTRIBUTE);
    element.removeAttribute('target');
  }

  /**
   * Rewrites relative URLs on matching elements to Azure DevOps attachment URLs.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} selector - CSS selector used to find matching elements.
   * @param {string} attributeName - Attribute that contains the relative URL.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {void} Does not return a value.
   */
  private rewriteElementUrls(
    document: Document,
    selector: string,
    attributeName: string,
    reportDirectory: string,
    assetUrlsByPath: Map<string, string>,
  ): void {
    document.querySelectorAll(selector).forEach((element) => {
      const currentValue = element.getAttribute(attributeName);
      if (!currentValue || isExternalUrl(currentValue)) {
        return;
      }

      const resolvedPath = resolveRelativeReportPath(
        reportDirectory,
        currentValue,
      );
      const resolvedUrl = assetUrlsByPath.get(resolvedPath);
      if (resolvedUrl) {
        element.setAttribute(attributeName, resolvedUrl);
      }
    });
  }

  /**
   * Rewrites relative URLs found inside inline style blocks.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {void} Does not return a value.
   */
  private rewriteInlineStyles(
    document: Document,
    reportDirectory: string,
    assetUrlsByPath: Map<string, string>,
  ): void {
    document.querySelectorAll('style').forEach((styleElement) => {
      if (!styleElement.textContent) {
        return;
      }

      styleElement.textContent = this.rewriteCssUrls(
        styleElement.textContent,
        reportDirectory,
        assetUrlsByPath,
      );
    });
  }

  /**
   * Injects layout CSS so the embedded report can size itself predictably.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @returns {void} Does not return a value.
   */
  private injectFrameLayoutStyles(document: Document): void {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      html, body {
        margin: 0 !important;
        overflow: hidden !important;
      }
    `;

    if (document.head) {
      document.head.appendChild(styleElement);
      return;
    }

    document.documentElement.prepend(styleElement);
  }

  /**
   * Injects the helper script that reports height changes and internal navigation.
   *
   * @param {Document} document - Parsed report document being rewritten.
   * @param {string} attachmentName - Attachment name of the current report page.
   * @returns {void} Does not return a value.
   */
  private injectNavigationScript(
    document: Document,
    attachmentName: string,
  ): void {
    const scriptElement = document.createElement('script');
    scriptElement.textContent = this.buildNavigationScript(attachmentName);

    if (document.body) {
      document.body.appendChild(scriptElement);
      return;
    }

    document.documentElement.appendChild(scriptElement);
  }

  /**
   * Builds the helper script injected into every embedded report page.
   *
   * @param {string} attachmentName - Attachment name of the current report page.
   * @returns {string} Script source that reports sizing and intercepts internal links.
   */
  private buildNavigationScript(attachmentName: string): string {
    return [
      this.buildHeightObserverScript(attachmentName),
      this.buildLinkNavigationScript(),
    ].join('\n');
  }

  /**
   * Builds the script block that keeps the host iframe height in sync.
   *
   * @param {string} attachmentName - Attachment name of the current report page.
   * @returns {string} Script source that posts height updates to the parent window.
   */
  private buildHeightObserverScript(attachmentName: string): string {
    return `
      (function () {
        function getDocumentHeight() {
          var body = document.body;
          var doc = document.documentElement;
          return Math.max(body ? body.scrollHeight : 0, body ? body.offsetHeight : 0, doc ? doc.scrollHeight : 0, doc ? doc.offsetHeight : 0);
        }

        function notifyHeight() {
          window.parent.postMessage({ type: "${INTERNAL_REPORT_HEIGHT_MESSAGE}", attachmentName: "${attachmentName}", height: getDocumentHeight() }, "*");
        }

        window.addEventListener("load", notifyHeight);
        window.addEventListener("resize", notifyHeight);
        if (typeof MutationObserver !== "undefined") {
          var observer = new MutationObserver(notifyHeight);
          observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
        }

        notifyHeight();
      })();
    `;
  }

  /**
   * Builds the script block that routes internal report links through the host.
   *
   * @returns {string} Script source that intercepts internal report links.
   */
  private buildLinkNavigationScript(): string {
    return `
      document.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof Element)) { return; }

        var link = target.closest("a[${INTERNAL_REPORT_LINK_ATTRIBUTE}], a[${INTERNAL_REPORT_MISSING_LINK_ATTRIBUTE}]");
        if (!link) { return; }

        var attachmentName = link.getAttribute("${INTERNAL_REPORT_LINK_ATTRIBUTE}");
        event.preventDefault();
        if (attachmentName) {
          window.parent.postMessage({ type: "${INTERNAL_REPORT_NAVIGATION_MESSAGE}", attachmentName: attachmentName }, "*");
          return;
        }

        var missingTarget = link.getAttribute("${INTERNAL_REPORT_MISSING_LINK_ATTRIBUTE}");
        if (missingTarget) {
          window.parent.postMessage({ type: "${INTERNAL_REPORT_NAVIGATION_MESSAGE}", missingTarget: missingTarget }, "*");
        }
      }, true);
    `;
  }

  /**
   * Builds a lookup table from normalized manifest paths to Azure DevOps URLs.
   *
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @returns {Map<string, string>} Map of normalized asset paths to download URLs.
   */
  private buildAssetUrlMap(manifest: ReportManifest): Map<string, string> {
    const assetUrlsByPath = new Map<string, string>();

    getManifestEntries(manifest).forEach((entry) => {
      const relativePath = normalizeReportPath(getReportPath(entry));

      try {
        assetUrlsByPath.set(
          relativePath,
          this.attachmentClient.getReportUrl(entry.attachmentName),
        );
      } catch {
        return;
      }
    });

    return assetUrlsByPath;
  }

  /**
   * Resolves a manifest entry from a relative URL found inside the current report.
   *
   * @param {ReportManifest} manifest - Manifest that describes the available report files.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {string} relativeUrl - Relative URL found in the report markup.
   * @returns {ReportManifestEntry | undefined} Matching manifest entry when found.
   */
  private findManifestEntryForRelativeUrl(
    manifest: ReportManifest,
    reportDirectory: string,
    relativeUrl: string,
  ): ReportManifestEntry | undefined {
    const resolvedPath = resolveRelativeReportPath(
      reportDirectory,
      relativeUrl,
    );

    return getManifestEntries(manifest).find(
      (entry) => normalizeReportPath(getReportPath(entry)) === resolvedPath,
    );
  }

  /**
   * Rewrites relative `url(...)` references inside CSS text.
   *
   * @param {string} cssText - Raw CSS text to rewrite.
   * @param {string} reportDirectory - Directory of the current report page.
   * @param {Map<string, string>} assetUrlsByPath - Map of normalized asset paths to download URLs.
   * @returns {string} CSS text with rewritten asset URLs.
   */
  private rewriteCssUrls(
    cssText: string,
    reportDirectory: string,
    assetUrlsByPath: Map<string, string>,
  ): string {
    return cssText.replace(
      /url\((['"]?)([^)'"]+)\1\)/g,
      (_match, quote, assetUrl) => {
        if (!assetUrl || isExternalUrl(assetUrl)) {
          return `url(${quote}${assetUrl}${quote})`;
        }

        const resolvedPath = resolveRelativeReportPath(
          reportDirectory,
          assetUrl,
        );
        const resolvedUrl = assetUrlsByPath.get(resolvedPath);
        if (!resolvedUrl) {
          return `url(${quote}${assetUrl}${quote})`;
        }

        return `url(${quote}${resolvedUrl}${quote})`;
      },
    );
  }

  /**
   * Downloads and caches attachment text used by linked assets.
   *
   * @param {string} attachmentName - Attachment name to download.
   * @returns {Promise<string>} Attachment body as text.
   * @throws {Error} Throws when the attachment cannot be downloaded.
   */
  private getCachedAttachmentContent(attachmentName: string): Promise<string> {
    const cachedContent = this.linkedAssetContentCache.get(attachmentName);
    if (cachedContent) {
      return cachedContent;
    }

    // Reuse attachment downloads while one report pulls in many linked assets.
    const fetchPromise = this.attachmentClient
      .getReportContent(attachmentName)
      .catch((error) => {
        this.linkedAssetContentCache.delete(attachmentName);
        throw error;
      });

    this.linkedAssetContentCache.set(attachmentName, fetchPromise);
    return fetchPromise;
  }

  /**
   * Creates and caches a blob URL for a linked script attachment.
   *
   * @param {string} attachmentName - Script attachment name to download.
   * @returns {Promise<string>} Blob URL that can be assigned to a script tag.
   * @throws {Error} Throws when the script attachment cannot be downloaded.
   */
  private getCachedScriptBlobUrl(attachmentName: string): Promise<string> {
    const cachedBlobUrl = this.scriptBlobUrlCache.get(attachmentName);
    if (cachedBlobUrl) {
      return cachedBlobUrl;
    }

    // Cache generated blob URLs so repeated navigation stays cheap.
    const blobUrlPromise = this.getCachedAttachmentContent(attachmentName)
      .then((scriptContent) => {
        const blobUrl = URL.createObjectURL(
          new Blob([scriptContent], { type: 'text/javascript' }),
        );
        this.createdObjectUrls.add(blobUrl);
        return blobUrl;
      })
      .catch((error) => {
        this.scriptBlobUrlCache.delete(attachmentName);
        throw error;
      });

    this.scriptBlobUrlCache.set(attachmentName, blobUrlPromise);
    return blobUrlPromise;
  }
}
