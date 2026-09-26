# Temiroff Edifice

Смета реконструкции бизнес-центра, Навои.

Открытый просмотр: https://fmlybnd.github.io/temiroff-edifice/

Пароль нужен только чтобы править (ген. директор).

## Где править

Всё хранится обычным текстом. Правки можно вносить прямо в редакторе GitHub.

| Что | Файл |
|---|---|
| Заявки 1С: статус оплаты, приоритет | `assets/expenses.js` (`"status"`: `sign` / `debt` / `paid`, `"priority": true`) |
| Договоры, этажи, лифт, примерные цены | `assets/data.js` |
| СМР здания: разделы, реестр, итоги «Оплачено / В долгах» | `assets/works.js` (итоги в `meta` — руками) |
| Стадии позиций | `assets/status.js` |
| Код сайта | `assets/app.js` |
| 3D-стройка: размеры, этапы, тексты | `assets/model-data.js` (журнал правок — `docs/model-changelog.md`) |
| 3D-стройка: сцена | `assets/model.js`, Three.js r147 в `assets/vendor/three/` (работает офлайн) |

Плитки «Уже оплачено / В долгу / На подписи» на главной и в «Расходах» считаются сами из `expenses.js`.

3D-модель (`model.html`) открывается и без интернета — двойным кликом.
Внутренние заметки модели лежат в `assets/model-private.js`: он в `.gitignore` и в репозиторий не попадает (шаблон — `assets/model-private.example.js`).
Промт для доработок через Grok Build — `docs/grok-build-prompt.md`.
