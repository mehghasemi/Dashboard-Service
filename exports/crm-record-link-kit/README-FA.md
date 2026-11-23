# دکمهٔ «بازکردن در CRM»

این بسته همان قابلیت نشان‌داده‌شده در پنجرهٔ جزئیات کیس را برای پروژهٔ دیگر جدا کرده است. دکمه، با شناسهٔ رکورد CRM یک URL برای صفحهٔ رکورد می‌سازد و آن را در تب جدید باز می‌کند. خود دکمه داده را از API دریافت نمی‌کند؛ نمایش جزئیات پس از باز شدن، بر عهدهٔ CRM و نشست کاربر در مرورگر است.

## فایل‌ها

- `original-support-crm-links.mjs`: تابع اصلی پروژه، بدون تغییر. آدرس CRM در آن ثابت است.
- `crm-record-link.mjs`: نسخهٔ قابل‌استفادهٔ مجدد؛ آدرس CRM قابل‌تنظیم است و لینک با DOM API ساخته می‌شود.
- `example.html`: نمونهٔ سه دکمهٔ کیس، مشتری و برنامهٔ مرتبط.
- `*.test.mjs`: آزمون تابع اصلی و نسخهٔ قابل‌استفادهٔ مجدد.

محل استفاده در پروژهٔ اصلی: `platform/public/support-ui.mjs`، تابع `crmLink` در ابتدای فایل و `recordDialog` در بخش پنجرهٔ جزئیات. نگاشت اصلی موجودیت‌ها در `platform/public/support-crm-links.mjs` است.

## شکل لینک

```text
https://crm.baridsoft.ir/Main/main.aspx?etn=incident&pagetype=entityrecord&id=GUID
```

- `etn`: نام منطقی entity در CRM؛ برای کیس و بکلاگ `incident`، برای مشتری `account`، برای پروژه `brd_project`.
- `pagetype=entityrecord`: درخواست صفحهٔ یک رکورد.
- `id`: GUID واقعی همان رکورد در CRM، مانند `incidentid` یا `accountid`.
- این URL رابط وب CRM است؛ آدرس `/api/data/v9.1/` برای Web API است و برای این دکمه استفاده نمی‌شود.

## استفادهٔ ساده در پروژهٔ دیگر

```html
<div id="case-actions" dir="rtl"></div>
<script type="module">
  import {appendCrmRecordLink} from './crm-record-link.mjs';
  const caseRow = {
    crm_id: '10000000-0000-4000-8000-000000000001',
    customer_id: '20000000-0000-4000-8000-000000000002',
    parent_id: '30000000-0000-4000-8000-000000000003'
  };
  const box = document.querySelector('#case-actions');
  appendCrmRecordLink(box, 'planning', caseRow.crm_id, {
    label: 'بازکردن در CRM',
    baseUrl: 'https://crm.baridsoft.ir/Main/main.aspx'
  });
  appendCrmRecordLink(box, 'customer', caseRow.customer_id, {
    label: 'مشتری در CRM'
  });
  appendCrmRecordLink(box, 'backlogs', caseRow.parent_id, {
    label: 'برنامه مرتبط در CRM'
  });
</script>
```

`createCrmRecordLink` یک عنصر `<a>` یا برای شناسهٔ نامعتبر `null` برمی‌گرداند؛ `appendCrmRecordLink` همان عنصر را به ظرف اضافه می‌کند. لینک در تب جدید با `rel="noopener noreferrer"` باز می‌شود. متن دکمه با `textContent` گذاشته می‌شود تا عنوان رکورد به HTML تبدیل نشود.

## نگاشت source به entity

| source ورودی | entity در CRM |
| --- | --- |
| `planning`، `cases`، `backlogs`، `periodic`، `incident` | `incident` |
| `customer`، `customers`، `account` | `account` |
| `projects`، `brd_project` | `brd_project` |
| `activities`، `activitypointer` | `activitypointer` |
| `task` | `task` |
| `annotation` | `annotation` |

در این پروژه «برنامهٔ مرتبط» و بکلاگ در entity `incident` قرار دارند. اگر CRM پروژهٔ مقصد schema دیگری دارد، نگاشت `ENTITIES` در ماژول مستقل را مطابق نام منطقی entityهای آن تغییر دهید.

## شناسه‌هایی که باید از دادهٔ خودتان بگیرید

- دکمهٔ کیس: `row.crm_id || row.id`، به شرطی که شناسهٔ واقعی `incidentid` باشد.
- دکمهٔ مشتری: `row.customer_id`، شناسهٔ `accountid`.
- دکمهٔ برنامهٔ مرتبط: `row.parent_id`، شناسهٔ رکورد مرتبط `incident`.
- اگر ID خالی، محلی یا غیر GUID باشد، دکمه ساخته نمی‌شود. شمارهٔ کیس مثل `CAS-...`، عنوان یا شمارهٔ مشتری جای GUID نیست.
- GUID و entity باید متعلق به همان محیط CRM باشند که `baseUrl` به آن اشاره می‌کند.

## احراز هویت و رفتار اجرا

کاربر باید در همان مرورگر به CRM مقصد دسترسی داشته باشد. اگر نشست CRM وجود نداشته باشد، خود CRM صفحهٔ ورود را نشان می‌دهد. این لینک رمز، توکن یا دادهٔ CRM را در URL قرار نمی‌دهد و از مجوزهای همان کاربر در CRM پیروی می‌کند. برای باز شدن مستقیم صفحهٔ رکورد، کاربر باید مجوز مشاهدهٔ آن رکورد را داشته باشد.

`baseUrl` باید آدرس HTTPS صفحهٔ `main.aspx` محیط مقصد باشد؛ نمونهٔ این پروژه `https://crm.baridsoft.ir/Main/main.aspx` است. در پروژهٔ دیگر این مقدار را از تنظیمات معتبر برنامه بگیرید، نه از ورودی آزاد کاربر.

## آزمون

```powershell
node --test --test-isolation=none crm-record-link.test.mjs original-support-crm-links.test.mjs
```

این آزمون‌ها ساخت URL، نگاشت entity، GUID نامعتبر و HTTPS را پوشش می‌دهند. باز شدن واقعی رکورد در CRM به نشست و دسترسی کاربر در محیط مقصد وابسته است.
