# Reusable CRM View source kit

این پوشه، بخش «منابع و تنظیمات» داشبورد خدمات را برای استفاده در برنامهٔ دیگر جدا می‌کند. فایل‌ها مستقل از رابط و ذخیره‌سازی فعلی هستند. کد اصلی برنامه نیز در `platform/public/support-ui.mjs`، `platform/support-http.mjs` و `platform/tools/support/crm-read.ps1` باقی است.

## فایل‌ها

- `view-source.mjs`: فهرست Viewها، اعتبارسنجی انتخاب، خواندن تعریف FetchXML و رکوردهای View.
- `view-picker.mjs`: فرم انتخاب View اصلی، یادداشت و فعالیت، دورهٔ دریافت و دریافت خودکار.
- `server-adapter.mjs`: قرارداد HTTP نمونه برای اتصال فرم به بک‌اند.
- `original-crm-read.ps1`: کد کامل کنونی برنامه برای Windows Integrated Authentication، WhoAmI، تشخیص ستون‌ها، FetchXML، paging-cookie، یادداشت‌ها و فعالیت‌ها. این فایل به میزبان CRM فعلی محدود است و برای انتقال به برنامهٔ دیگر باید متناسب با همان محیط بازبینی شود.
- `view-source.test.mjs`: آزمون‌های بدون دسترسی واقعی به CRM.

## جریان کار

1. بک‌اند با هویت CRM همان کاربر یک تابع `requestJson(url)` برای GET مجاز فراهم می‌کند. رمز یا توکن را به مرورگر ندهید.
2. `listViews()` هر دو منبع `savedqueries` (عمومی/سیستمی) و `userqueries` (شخصی) را می‌خواند. فیلدهای خروجی: `id`، `kind`، `entity`، `name`.
3. فرم بر اساس نوع رکورد فیلتر می‌کند: اصلی `incident` یا `brd_project`؛ یادداشت `annotation`؛ فعالیت `task` یا `activitypointer`.
4. سرور قبل از ذخیره، فهرست مجاز همان کاربر را دوباره می‌خواند. فقط انتخاب‌هایی پذیرفته می‌شوند که شناسه، نوع و entity آنها با فهرست فعلی یکسان باشد.
5. هنگام دریافت داده، سرور تعریف View را از CRM دوباره می‌گیرد، `returnedtypecode` و entity داخل FetchXML را بررسی می‌کند و GET روی entity set مرتبط می‌زند. محدودیت‌ها: ۲۰۰ صفحه و ۱۰۰٬۰۰۰ رکورد.
6. تنظیمات باید برای هر کاربر و هر اتصال CRM جدا ذخیره شوند؛ با تغییر حساب یا اتصال، فهرست و دادهٔ قبلی نامعتبر شوند. برای دریافت خودکار، scheduler اپ مقصد باید `sync` را در بازهٔ ذخیره‌شده فراخوانی کند.

## اتصال به بک‌اند Node

```js
import {createViewApi} from './server-adapter.mjs';

const handleViews = createViewApi({
  baseUrl: 'https://YOUR-CRM/Main/api/data/v9.1/',
  // user از middleware احراز هویت برنامه می‌آید.
  // این تابع باید فقط GET مجاز را با هویت همان کاربر انجام دهد.
  requestJsonForUser: user => async url => {
    const response = await crmGetForUser(user, url);
    if (!response.ok) throw Error('CRM HTTP ' + response.status);
    return response.json();
  },
  // نمونهٔ واقعی باید پایدار و تفکیک‌شده بر اساس user.id و شناسهٔ اتصال CRM باشد.
  loadSettings: async userId => storage.read(userId),
  // ذخیره باید revision را اتمیک بررسی و سپس یک واحد افزایش دهد.
  saveSettings: async (userId, change) => storage.saveWithRevision(userId, change),
  modules: {
    planning: {mainEntity:'incident'},
    backlogs: {mainEntity:'incident'},
    projects: {mainEntity:'brd_project'}
  }
});
// داخل HTTP server، پس از احراز هویت:
// if (req.url.startsWith('/api/view-sources/')) return handleViews(req,res,user);
```

چهار endpoint نمونه: `GET /api/view-sources/catalog`، `GET /api/view-sources/settings`، `POST /api/view-sources/settings`، `POST /api/view-sources/sync`. پاسخ settings باید `{revision,settings}` باشد. تابع save باید `{revision}` جدید برگرداند. اطلاعات ورود CRM در settings ذخیره نمی‌شود.

## اتصال فرم

```html
<div id="view-sources" lang="fa" dir="rtl"></div>
<script type="module">
  import {mountViewPicker} from './view-picker.mjs';
  mountViewPicker('#view-sources', {
    modules:[
      {id:'planning',label:'برنامه‌ریزی و کیس‌ها',mainEntity:'incident'},
      {id:'backlogs',label:'بکلاگ‌ها',mainEntity:'incident'},
      {id:'projects',label:'پروژه‌ها',mainEntity:'brd_project'}
    ]
  });
</script>
```

رابط با DOM API ساخته می‌شود تا نام View دریافتی از CRM به HTML تفسیر نشود. ظاهر فرم را با CSS برنامهٔ مقصد تنظیم کنید.

## محدودیت و تفاوت با کد اصلی

ماژول مستقل، paging از نوع `@odata.nextLink` را پشتیبانی می‌کند. بعضی FetchXML Viewها در CRM فعلی فقط `fetchxmlpagingcookie` می‌دهند؛ در آن حالت ماژول خطا می‌دهد تا دادهٔ ناقص به‌عنوان نتیجهٔ کامل ذخیره نشود. برای این Viewها از منطق کامل `original-crm-read.ps1` استفاده کنید یا همان منطق paging-cookie را در adapter مقصد پیاده‌سازی کنید. کد اصلی همچنین `WhoAmI` را با هویت اتصال بررسی می‌کند و ستون‌های مورد نیاز داشبورد را به FetchXML اضافه می‌کند؛ اگر اپ مقصد به آن ستون‌ها وابسته است، این دو مرحله را نگه دارید.

`requestJson` نباید redirect به میزبان دیگر را دنبال کند و باید HTTPS، مسیر API، زمان‌سنجی، محدودیت اندازهٔ پاسخ و مجوز CRM کاربر را اعمال کند. `server-adapter.mjs` اسکلت اتصال است؛ احراز هویت، ذخیره‌سازی پایدار و scheduler مخصوص اپ مقصد باید توسط همان اپ فراهم شوند.

## آزمون

```powershell
node --test --test-isolation=none view-source.test.mjs
```
