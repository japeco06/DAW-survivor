/**
 * Sistema de Internacionalización (i18n) para Cyber Survivor (v1.1.0).
 * Soporta alternancia reactiva entre Español (ES) e Inglés (EN)
 * con persistencia automática en localStorage.
 */

export type Language = 'ES' | 'EN';

const STORAGE_KEY = 'cyber_survivor_lang';

class I18nManager {
  private lang: Language = 'ES';

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'EN' || saved === 'ES') {
        this.lang = saved;
      }
    } catch {
      // Silenciar errores de localStorage
    }
  }

  public get currentLang(): Language {
    return this.lang;
  }

  public setLanguage(lang: Language): void {
    this.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Silenciar errores de localStorage
    }
  }

  /**
   * Devuelve la cadena traducida según el idioma activo actual.
   * @param es Texto en Español
   * @param en Texto en Inglés
   */
  public t(es: string, en: string): string {
    return this.lang === 'EN' ? en : es;
  }
}

export const i18n = new I18nManager();
