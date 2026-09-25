# Invan `api/v1` — TO'LIQ endpoint ro'yxati

> **Manba:** `my.invan.uz/assets/index.*.js` — Invan saytining o'z frontend kodi.
> Sayt har bir bo'limni ko'rsatish uchun qaysi endpointni chaqirishini o'sha kodda
> `request({method, url})` ko'rinishida ochiq saqlaydi. 2026-07-30 da ajratildi.
>
> **Baza:** `https://api.7i.uz/api/v1` — sarlavhalar: `Authorization: Bearer <token>`,
> `timezone: 300`, `Content-Type: application/json`.
> `api_token.txt`dagi joriy token bu API'da ishlaydi (tasdiqlangan).
>
> ⚠️ **DIQQAT:** bu ro'yxat — sayt chaqiradigan endpointlar. Ularning **hammasi sinalmagan**;
> jonli tasdiqlanganlari [invan_tahlili.md](invan_tahlili.md) §7 da belgilangan.
>
> 🟢 = o'qish (xavfsiz) &nbsp;&nbsp; 🔴 = **YOZUV/O'CHIRISH — ehtiyot bo'ling**
> (ba'zi POST'lar aslida o'qish: ro'yxat-filtr va Excel eksport — ular 🟢 belgilangan)

**Jami: 323 noyob endpoint, 154 bo'lim** (~157 o'qish, ~166 yozuv)

## Bizning loyiha uchun eng qimmatlisi — `reports/*`

[invan_tahlili.md](invan_tahlili.md) §6 da "ENG QIYMATLI, lekin bizda yo'q" deb
belgilangan hisobotlarning **hammasi** API orqali olinadi — qo'lda Excel eksport shart emas:

| Hisobot | Endpoint | Nima beradi |
|---|---|---|
| reports/inventory_turnover | `POST reports/inventory_turnover` | Opening + In − Out = Closing (stok formula audити) |
| reports/adjustments | `POST reports/adjustments` | har sotuvda Before/After stok harakati (manfiy stok xatolari) |
| reports/cost_of_goods | `GET reports/cost_of_goods` | COGS + **Average Cost** + Gross Profit |
| reports/category | `GET reports/category` | kategoriya kesimida Cost va real **marja** |
| reports/suppliers | `GET reports/suppliers` | ta'minotchi kesimida Cost va **Gross Profit** |
| reports/profit_loss | `GET reports/profit_loss` | Foyda/Zarar hisoboti |
| reports/employee | `GET reports/employee` | xodim kesimida **refund soni** |
| reports/abc_analysis | `POST reports/abc_analysis` | Invan'ning ABC + **Nako %** (ustama) |
| reports/sales_by_products | `POST reports/sales_by_products` | kunlik sotuv jadvali (Daily Reports) |
| reports/my_inventory | `POST reports/my_inventory` / `all_my_inventory` | On Hand + Unit/Total Cost |
| /reports/inventory_by_supplier | `GET /reports/inventory_by_supplier` | ta'minotchi bo'yicha zaxira |
| /reports/{client_id}/customer | `GET /reports/{client_id}/customer` | **mijoz/firmaning sotuv tarixi** |

---
## Bo'limlar bo'yicha to'liq ro'yxat

### `reports` (20)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/reports/${id2}/customer` | `getSingleCustomer` |
| 🟢 | `GET` | `/reports/inventory_by_supplier` | `getSupplierProduct` |
| 🟢 | `GET` | `/reports/${id2}` | `getSingleShift` |
| 🟢 | `GET` | `/reports/category` | `getAllCategory` |
| 🟢 | `GET` | `/reports/cost_of_goods` | `getAllCostOfGoods` |
| 🟢 | `GET` | `/reports/employee` | `getAllEmployee` |
| 🟢 | `GET` | `/reports/inventory` | `getAllInventory` |
| 🟢 | `GET` | `/reports/profit_loss` | `getProfitLossReport` |
| 🟢 | `GET` | `/reports/registers` | `getAllRegister` |
| 🟢 | `GET` | `/reports/shift` | `getAllShifts` |
| 🟢 | `GET` | `/reports/suppliers` | `getAllSuppliers` |
| 🟢 | `POST` | `/reports/abc_analysis` | `getAllAbcAnalysis` |
| 🟢 | `POST` | `/reports/adjustments` | `getAllAdjustment` |
| 🟢 | `POST` | `/reports/all_my_inventory` | `getAllMyInventory` |
| 🟢 | `POST` | `/reports/all_my_inventory_statistics` | `myInventoryStatistics` |
| 🟢 | `POST` | `/reports/inventory_turnover` | `getAllInventoryTurnover` |
| 🟢 | `POST` | `/reports/my_inventory` | `getAllPurchasingManagements` |
| 🟢 | `POST` | `/reports/orders` | `getAllInventoryPurchase` |
| 🟢 | `POST` | `/reports/sales` | `getAllSalesFilter` |
| 🟢 | `POST` | `/reports/sales_by_products` | `getDailyReports` |

### `client` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/client/${id2}` | `getClient` |
| 🔴 | `POST` | `/client` | `createClient` |
| 🔴 | `PUT` | `/client/${id2}` | `updateClient` |
| 🔴 | `DELETE` | `/client/${id2}` | `deleteClient` |

### `clients` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/clients` | `filterClients` |

### `clients_search` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/clients_search` | `getClients` |

### `customer_group` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/customer_group` | `getCustomerGroups` |
| 🟢 | `GET` | `/customer_group/${id2}` | `getCustomerGroupSingle` |
| 🔴 | `POST` | `/customer_group` | `createCustomer` |
| 🔴 | `PUT` | `/customer_group/${id2}` | `editCustomerGroup` |
| 🔴 | `DELETE` | `/customer_group/${id2}` | `deleteCustomerGroup` |

### `account` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/account` | `getAccounts` |
| 🟢 | `GET` | `/account/${id2}` | `getSingleAccount` |
| 🔴 | `POST` | `/account` | `createAccount` |
| 🔴 | `PUT` | `/account/${id2}` | `editAccount` |
| 🔴 | `DELETE` | `/account/${id2}` | `deleteAccount` |

### `abc_analysis_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/abc_analysis_excel` | `getDownloadAbcAnalysis` |

### `all_ecommerce_orders_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/all_ecommerce_orders_excel` | `excelDownloadOrders` |

### `all_my_inventories_reports_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/all_my_inventories_reports_excel` | `getDownloadMyInventory` |

### `all_sales_reports_by_products_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/all_sales_reports_by_products_excel` | `excelDailyReports` |

### `all_shifts_report` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/all_shifts_report` | `getDownloadShifts` |

### `cashbox` (6)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/cashbox/${id2}` | `getCashbox` |
| 🟢 | `GET` | `/cashbox` | `—` |
| 🟢 | `GET` | `/cashbox/${id2}` | `—` |
| 🔴 | `POST` | `/cashbox` | `—` |
| 🔴 | `PUT` | `/cashbox/${id2}` | `—` |
| 🔴 | `DELETE` | `/cashbox/${id2}` | `—` |

### `category` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/category` | `getCategories` |
| 🔴 | `POST` | `/category` | `createCategory` |
| 🔴 | `PUT` | `/category/${id2}` | `updateCategory` |
| 🔴 | `DELETE` | `/category/${id2}` | `deleteCategory` |

### `category_export` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/category_export` | `exportCategory` |

### `category_for_ecommerce` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/category_for_ecommerce` | `getCategoriesForEccommerce` |

### `category_for_product` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/category_for_product` | `getCategoriesForProduct` |

### `charts_of_accounts` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/charts_of_accounts` | `getChartsOfAccounts` |
| 🟢 | `GET` | `/charts_of_accounts/${id2}` | `getSingleChartsOfAccount` |
| 🔴 | `POST` | `/charts_of_accounts` | `createChartsOfAccount` |
| 🔴 | `PUT` | `/charts_of_accounts/${id2}` | `editChartsOfAccount` |
| 🔴 | `DELETE` | `/charts_of_accounts/${id2}` | `deleteChartsOfAccount` |

### `charts_of_accounts_types` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/charts_of_accounts_types` | `getChartsOfAccountsTypes` |

### `check_mxik_lenght` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/check_mxik_lenght` | `checkMxikLength` |

### `cheque` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/cheque` | `—` |
| 🟢 | `GET` | `/cheque/${id2}` | `—` |
| 🔴 | `PUT` | `/cheque/${id2}` | `updateCheque` |
| 🔴 | `POST` | `/cheque` | `createCheque` |
| 🔴 | `DELETE` | `/cheque/${id2}` | `—` |

### `cheque_blocks` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/cheque_blocks` | `—` |

### `clients_export` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/clients_export` | `clientsExport` |

### `company` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/company` | `—` |

### `company_apps` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/company_apps` | `—` |
| 🔴 | `PUT` | `/company_apps` | `—` |

### `company_didox` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/company_didox` | `—` |

### `company_discount` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/company_discount` | `getCompanyDiscount` |
| 🟢 | `GET` | `/company_discount/${id2}` | `getCompanyDiscountById` |
| 🔴 | `POST` | `/company_discount` | `createCompanyDiscount` |
| 🔴 | `PUT` | `/company_discount/${id2}` | `updateCompanyDiscount` |
| 🔴 | `DELETE` | `/company_discount/${id2}` | `deleteCompanyDiscount` |

### `company_discounts` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/company_discounts` | `getCompanyDiscounts` |

### `company_repricing` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/company_repricing` | `—` |

### `company_shop` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/company_shop/${id2}` | `—` |
| 🔴 | `PUT` | `/company_shop` | `—` |

### `company_shop_banners` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/company_shop_banners` | `updateBanners` |

### `company_subscription_type` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/company_subscription_type/${id2}` | `—` |
| 🔴 | `PUT` | `/company_subscription_type` | `—` |

### `company_tax_info` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/company_tax_info` | `—` |

### `company_token` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/company_token` | `—` |

### `csvtemplate_product` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/csvtemplate_product` | `downloadProductsCSV` |

### `current_company` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/current_company` | `—` |

### `custom_field` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/custom_field` | `getAllFields` |
| 🟢 | `GET` | `/custom_field/${id2}` | `getSingleCustomField` |
| 🔴 | `POST` | `/custom_field` | `createCustomField` |
| 🔴 | `PUT` | `/custom_field/${id2}` | `editCustomField` |
| 🔴 | `DELETE` | `/custom_field/${id2}` | `—` |

### `custom_fields_type_name` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/custom_fields_type_name` | `getCustomFieldtypes` |

### `custom_return` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/custom_return/${id2}` | `ReturnFinishSupplierOrder` |

### `custom_supplier_order` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/custom_supplier_order` | `createCustomSupplierReturn, supplierReturnOrderItem` |

### `customer_discount` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/customer_discount/${id2}` | `getCustomerGroupDiscount` |

### `customer_report` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/customer_report/${id2}` | `downloadCustomerHistory` |

### `deleted_products` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/deleted_products` | `getDeletedProducts` |

### `department` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/department/${id2}` | `getDepartmentId` |
| 🔴 | `POST` | `/department` | `createDepartments` |
| 🔴 | `PUT` | `/department/${id2}` | `updateDepartment` |
| 🔴 | `DELETE` | `/department/${id2}` | `deleteDepartment` |

### `departments` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/departments` | `getDepartments` |

### `didox` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/didox/${id2}` | `saleDidoxPostId` |

### `ecommerce_order` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/ecommerce_order/${id2}` | `getEcommerceOrdersById` |
| 🔴 | `PUT` | `/ecommerce_order/${id2}` | `updateEcommerceOrdersStatus` |

### `ecommerce_order_item` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/ecommerce_order_item` | `addOrders` |

### `ecommerce_order_item_by_admin` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/ecommerce_order_item_by_admin` | `updateOrders` |

### `ecommerce_order_items` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `DELETE` | `/ecommerce_order_items` | `deleteOrders` |

### `ecommerce_order_upd` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/ecommerce_order_upd/${id2}` | `updateEcommerceOrdersComment` |

### `ecommerce_orders` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/ecommerce_orders` | `getEcommerceOrdersAll` |

### `employee` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/employee/${id2}` | `getEmployee` |
| 🔴 | `POST` | `/employee` | `createEmployee` |
| 🔴 | `DELETE` | `/employee/${id2}` | `deleteEmployee` |
| 🔴 | `PUT` | `/employee/${id2}` | `updateEmployee` |

### `employees` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/employees` | `getEmployees` |

### `employees_export` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/employees_export` | `getEmployeesExport` |

### `exceltemplate` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/exceltemplate` | `getExampleExcel` |
| 🟢 | `POST` | `/exceltemplate/${id2}` | `excelDownloadOrder, supplierOrderExcel` |

### `exceltemplate_finance_supplier` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/exceltemplate_finance_supplier/${id2}` | `exportSupplierTransactionById` |

### `exceltemplate_import` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/exceltemplate_import/${id2}` | `downloadExcelById` |

### `exceltemplate_invoice` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/exceltemplate_invoice/${id2}` | `excelItemInvoice` |

### `exceltemplate_product` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/exceltemplate_product` | `downloadProductsExcel` |

### `exceltemplate_supplier` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/exceltemplate_supplier` | `exportSuppliers` |

### `exceltemplate_writeoff` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/exceltemplate_writeoff/${id2}` | `downloadWriteOff` |

### `finance_account` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/finance_account/${id2}/history` | `getSingleAccountHistory` |

### `finance_category` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/finance_category` | `getFinanceCategories` |
| 🔴 | `POST` | `/finance_category` | `createFinanceCategory` |
| 🔴 | `DELETE` | `/finance_category/${id2}` | `deleteFinanceCategory` |
| 🔴 | `PUT` | `/finance_category/${id2}` | `updateFinanceCategory` |

### `finance_supplier` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/finance_supplier/${id2}` | `getByIdSupplierTransactions` |

### `finance_suppliers` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/finance_suppliers` | `getSupplierTransactions` |

### `finance_transaction` (3)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/finance_transaction/${id2}` | `getTransactionById` |
| 🔴 | `POST` | `/finance_transaction` | `createTransaction` |
| 🔴 | `PUT` | `/finance_transaction/${id2}` | `updateTransaction` |

### `finance_transaction_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/finance_transaction_excel` | `getDownloadTransactions` |

### `finance_transactions` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/finance_transactions` | `getTransactionsFilter` |
| 🔴 | `DELETE` | `/finance_transactions/${id2}` | `deleteSupplierTransaction` |

### `finished_supplier_order` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `DELETE` | `/finished_supplier_order/${id2}` | `deleteSupplierOrderFinished` |

### `get_supplier_order` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/get_supplier_order/${id2}` | `getSupplierOrder` |

### `get_transfer` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/get_transfer/${id2}` | `getTransfer` |

### `import` (7)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/import` | `getImports` |
| 🟢 | `GET` | `/import/${id2}/allitems` | `getImportItems` |
| 🟢 | `GET` | `/import/import-properties-template` | `getImportPropertiesTemplate` |
| 🔴 | `POST` | `/import` | `sendImportToValidation` |
| 🔴 | `DELETE` | `/import/${id2}` | `deleteImport` |
| 🔴 | `PUT` | `/import/${id2}/confirm` | `confirmImport` |
| 🔴 | `PUT` | `/import/${id2}/finish` | `acceptImport` |

### `inventory-count` (11)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/inventory-count` | `getInventoryCounts` |
| 🟢 | `GET` | `/inventory-count/${id2}` | `getInventoryCount` |
| 🟢 | `GET` | `/inventory-count/${id2}/export` | `exportInventoryCount` |
| 🔴 | `POST` | `/inventory-count` | `createInventoryCount` |
| 🔴 | `PUT` | `/inventory-count/${id2}` | `updateInventoryCount` |
| 🔴 | `DELETE` | `/inventory-count/${id2}` | `deleteInventoryCount` |
| 🔴 | `PUT` | `/inventory-count/${id2}/add-product` | `addProductInventoryCount` |
| 🔴 | `POST` | `/inventory-count/${id2}/autofill` | `autofillInventoryCount` |
| 🔴 | `PUT` | `/inventory-count/${id2}/finish` | `finishInventoryCount` |
| 🔴 | `POST` | `/inventory-count/${id2}/import` | `importInventoryCount` |
| 🔴 | `DELETE` | `/inventory-count/${inventoryCountId}/product/${productId}` | `deleteInventoryCountProduct` |

### `inventory_turnover_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/inventory_turnover_excel` | `getDownloadInventoryTurnover` |

### `invoice` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/invoice/${id2}` | `getInvoice` |
| 🔴 | `POST` | `/invoice` | `createInvoices` |
| 🔴 | `PUT` | `/invoice/${id2}` | `updateItemInvoice` |
| 🔴 | `DELETE` | `/invoice/${id2}` | `deleteInvoice` |

### `invoice_html` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/invoice_html/${id2}` | `printItemInvoice` |

### `invoice_item` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/invoice_item` | `addItemInvoice` |
| 🔴 | `DELETE` | `/invoice_item/${id2}` | `deleteItemInvoice` |

### `invoice_pdf` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/invoice_pdf/${id2}` | `pdfItemInvoice` |

### `invoices` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/invoices` | `getAllInvoices` |

### `label` (6)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/label` | `getPriceTags` |
| 🟢 | `GET` | `/label/${id2}` | `getPriceTag` |
| 🟢 | `GET` | `/label/product_field` | `getLayers` |
| 🔴 | `POST` | `/label` | `createPriceTag` |
| 🔴 | `DELETE` | `/label` | `deletePriceTag` |
| 🔴 | `PUT` | `/label/${id2}` | `updatePriceTag` |

### `measurement_unit` (6)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/measurement_unit` | `getMeasurementUnits` |
| 🟢 | `GET` | `/measurement_unit` | `—` |
| 🟢 | `GET` | `/measurement_unit/${id2}` | `—` |
| 🔴 | `POST` | `/measurement_unit` | `—` |
| 🔴 | `PUT` | `/measurement_unit/${id2}` | `—` |
| 🔴 | `DELETE` | `/measurement_unit/${id2}` | `—` |

### `module` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/module` | `getModules` |

### `my_inventory_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/my_inventory_excel` | `getDownloadPurchasingManagements` |

### `notifications` (3)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/notifications` _(base: https://ws.notification.7i.uz)_ | `getAllNotifications` |
| 🔴 | `POST` | `/notifications/mark-as-read` _(base: https://ws.notification.7i.uz)_ | `readNotifications` |
| 🔴 | `POST` | `/notifications/mark-as-read-by-company` _(base: https://ws.notification.7i.uz)_ | `onNotifications` |

### `order` (6)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/order/${id2}` | `getOrder` |
| 🔴 | `POST` | `/order` | `createOrder` |
| 🔴 | `DELETE` | `/order/${id2}/client` | `deleteOrderClient` |
| 🔴 | `POST` | `/order/${id2}/client` | `addOrderClient` |
| 🟢 | `POST` | `/order/all_sales_excel` | `excelDownloadSales` |
| 🟢 | `POST` | `/order/all_sales_excel_for_1c` | `excelDownloadSalesFor` |

### `order_comment` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/order_comment/${id2}` | `sendComment` |

### `order_discount` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/order_discount` | `addOrderDiscount` |

### `order_item` (3)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/order_item` | `—` |
| 🔴 | `PUT` | `/order_item/${id2}` | `editOrderItem` |
| 🔴 | `DELETE` | `/order_item/${id2}` | `deleteOrderItem` |

### `order_new` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/order_new` | `getAllOrder` |

### `order_payment` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/order_payment` | `orderPayment` |

### `order_products_for_sale` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/order_products_for_sale` | `—` |

### `order_statistics` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/order_statistics` | `getOrderStatistics` |

### `pay_by_loyalty` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/pay_by_loyalty/${id2}` | `orderPaymentWithLoyalty` |

### `payment` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/payment/all_analytics` | `getAllPayments` |

### `payment_type` (6)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/payment_type` | `getPaymentTypes` |
| 🟢 | `GET` | `/payment_type/${id2}` | `getSinglePaymentType` |
| 🟢 | `GET` | `/payment_type` | `—` |
| 🔴 | `POST` | `/payment_type` | `createPaymentType` |
| 🔴 | `DELETE` | `/payment_type/${id2}` | `deletePaymentType` |
| 🔴 | `PUT` | `/payment_type/${id2}` | `editPaymentType` |

### `payment_type_for_apps` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/payment_type_for_apps` | `getPaymentsForApps` |

### `prefix_generate` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/prefix_generate` | `generatePrefix` |

### `product` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/product/${id2}` | `getProduct` |
| 🟢 | `GET` | `/product/${id2}/history` | `getProductHistory` |
| 🔴 | `DELETE` | `/product` | `deleteProducts` |
| 🔴 | `POST` | `/product` | `createProduct` |
| 🔴 | `PUT` | `/product/${id2}` | `updateProduct` |

### `product_is_active` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/product_is_active/${id2}` | `updateIsActive` |

### `products` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/products` | `getProducts` |
| 🔴 | `PUT` | `/products` | `editProducts` |

### `products_for_sale` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/products_for_sale` | `—` |

### `profit_loss_excel` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/profit_loss_excel` | `exportProfitLossExcel` |

### `received_supplier_order` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/received_supplier_order/${id2}` | `receivedOrderSingleItem` |

### `refund_order_items` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/refund_order_items/${id2}` | `refundOrderItems` |

### `repricing` (7)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/repricing` | `getRepricingHistory` |
| 🟢 | `GET` | `/repricing/${repricing_id}/items` | `getRepricing` |
| 🔴 | `POST` | `/repricing` | `createRepricing` |
| 🔴 | `POST` | `/repricing/${repricing_id}` | `finishRepricing` |
| 🔴 | `DELETE` | `/repricing/${repricing_id}` | `deleteRepricing` |
| 🔴 | `POST` | `/repricing/${repricing_id}/items` | `addRepricingItem` |
| 🟢 | `POST` | `/repricing/all_history` | `getAllRepricingHistory` |

### `repricing_history` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/repricing_history` | `downloadRepricingExcel` |

### `repricing_info` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/repricing_info` | `—` |

### `repricing_item` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `DELETE` | `/repricing_item/${repricing_id}/${repricing_item_id}` | `deleteRepricingItem` |

### `repricing_items` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/repricing_items/${id2}` | `downloadRepricing` |

### `role` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/role` | `getRoles` |
| 🟢 | `GET` | `/role/${id2}` | `getRole` |
| 🔴 | `POST` | `/role` | `createRole` |
| 🔴 | `DELETE` | `/role/${id2}` | `deleteRole` |
| 🔴 | `PUT` | `/role/${id2}` | `editRole` |

### `sale` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/sale/${id2}` | `getSale` |

### `scales-template` (3)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/scales-template` | `getScalesTemplates` |
| 🟢 | `GET` | `/scales-template/${id2}` | `getScalesTemplate` |
| 🟢 | `POST` | `/scales-template` | `createScalesTemplate` |

### `shift` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/shift` | `cashboxShift` |

### `shift_statuses` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/shift_statuses` | `shiftStatuses` |

### `shop` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/shop` | `—` |
| 🟢 | `GET` | `/shop/${id2}` | `—` |
| 🔴 | `POST` | `/shop` | `—` |
| 🔴 | `PUT` | `/shop/${id2}` | `—` |
| 🔴 | `DELETE` | `/shop/${id2}` | `—` |

### `sku_generate` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/sku_generate` | `—` |

### `supplier` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/supplier/${id2}` | `getSupplier` |
| 🔴 | `POST` | `/supplier` | `createSupplier` |
| 🔴 | `PUT` | `/supplier/${id2}` | `updateSupplier` |
| 🔴 | `DELETE` | `/supplier/${id2}` | `deleteSupplier` |

### `supplier_finance` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_finance` | `exportSupplierTransactions` |

### `supplier_order` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/supplier_order/${id2}/allitems` | `getSupplierOrderItems` |
| 🔴 | `POST` | `/supplier_order` | `getSupplierOrders, createSupplierOrder` |
| 🔴 | `PUT` | `/supplier_order/${id2}` | `updateReturnSupplierOrder` |
| 🔴 | `POST` | `/supplier_order/${id2}/import_items` | `importSupplierOrderItems` |

### `supplier_order_amount` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/supplier_order_amount/${id2}` | `updateSupplierOrderCount` |

### `supplier_order_by_supplier` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_order_by_supplier` | `createSupplierOrderBySupplier` |

### `supplier_order_email` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_order_email/${id2}` | `supplierOrderEmail` |

### `supplier_order_finish` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/supplier_order_finish/${id2}` | `finishSupplierOrder` |

### `supplier_order_html` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/supplier_order_html/${id2}` | `htmlDownloadOrder` |

### `supplier_order_invoice` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/supplier_order_invoice/${id2}` | `supplierOrderInvoice` |

### `supplier_order_item` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_order_item` | `supplierOrderItem` |
| 🔴 | `DELETE` | `/supplier_order_item/${id2}` | `deleteSupplierOrderItem` |

### `supplier_order_item_by_supplier` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_order_item_by_supplier/${id2}` | `supplierOrderItemById` |

### `supplier_order_items` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/supplier_order_items/${id2}` | `getSupplierItems` |
| 🟢 | `GET` | `/supplier_order_items/${id2}/product_ids` | `getSupplierOrderIds` |

### `supplier_order_items_html` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/supplier_order_items_html/${id2}` | `htmlDownloadOrderItems` |

### `supplier_order_items_new` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/supplier_order_items_new/${id2}` | `getSupplierOrderItemsNew` |

### `supplier_order_multiple_items` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_order_multiple_items` | `supplierOrderMultipleItems` |

### `supplier_order_new` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/supplier_order_new/${id2}` | `getSupplierOrderItemsIdNew` |
| 🔴 | `POST` | `/supplier_order_new` | `createSupplierOrderNew` |

### `supplier_order_pdf` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/supplier_order_pdf/${id2}` | `pdfDownloadOrder` |

### `supplier_order_receive` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/supplier_order_receive/${id2}` | `receiveSingleSupplierOrderItem` |
| 🔴 | `PUT` | `/supplier_order_receive/${id2}/all` | `receiveSupplierOrderItem` |

### `supplier_order_return` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/supplier_order_return/${id2}` | `returnSupplierOrderItem` |

### `supplier_order_single_item` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_order_single_item` | `supplierOrderSingleItem` |

### `supplier_order_sms` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/supplier_order_sms/${id2}` | `supplierOrderSms` |

### `supplier_order_status` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/supplier_order_status/${id2}` | `supplierOrderStatus` |

### `supplier_orders` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `DELETE` | `/supplier_orders` | `deleteSupplierOrder` |

### `suppliers` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/suppliers` | `getSuppliers` |

### `telegram_subscriber` (3)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/telegram_subscriber` | `getTelegramSubscriber` |
| 🔴 | `PUT` | `/telegram_subscriber/${id2}` | `updateTelegramSubscriber` |
| 🔴 | `DELETE` | `/telegram_subscriber/${id2}` | `deleteTelegramSubscriber` |

### `transfer` (4)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/transfer` | `getTransfers` |
| 🔴 | `POST` | `/transfer` | `createTransfer` |
| 🔴 | `PUT` | `/transfer/${id2}` | `updateTransferHeader` |
| 🔴 | `PUT` | `/transfer/${id2}/in-transit` | `inTransitTransfer` |

### `transfer_html` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/transfer_html/${id2}` | `printTransferHtml` |

### `transfer_item` (2)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/transfer_item` | `createTransferItem` |
| 🔴 | `DELETE` | `/transfer_item/${id2}` | `deleteTransferItem` |

### `transfer_item_receive` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/transfer_item_receive/${id2}` | `transferItemReceive` |

### `transfer_items` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/transfer_items/${id2}` | `getTransferItems` |

### `transfer_items_receive` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `PUT` | `/transfer_items_receive/${id2}/all` | `receiveAllTransferItems` |

### `transfers` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `DELETE` | `/transfers` | `deleteTransfers` |

### `units` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/units` | `—` |

### `user` (7)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/user/get_user_by_phone` | `getUserByPhone` |
| 🟢 | `GET` | `/user/get_user_permission` | `getUserPermissions` |
| 🟢 | `GET` | `/user/get_shops` | `—` |
| 🟢 | `GET` | `/user/profile` | `—` |
| 🔴 | `POST` | `/user/logs` | `getActivity` |
| 🔴 | `POST` | `/user/change_password` | `—` |
| 🔴 | `PUT` | `/user/profile` | `—` |

### `vat` (5)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/vat` | `—` |
| 🟢 | `GET` | `/vat/${id2}` | `—` |
| 🔴 | `POST` | `/vat` | `—` |
| 🔴 | `PUT` | `/vat/${id2}` | `—` |
| 🔴 | `DELETE` | `/vat/${id2}` | `—` |

### `write-off` (8)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `GET` | `/write-off` | `getWriteOffs` |
| 🟢 | `GET` | `/write-off/${id2}` | `getWriteOff` |
| 🔴 | `POST` | `/write-off` | `createWriteOff` |
| 🔴 | `PUT` | `/write-off/${id2}` | `updateWriteOff` |
| 🔴 | `DELETE` | `/write-off/${id2}` | `deleteWriteOff` |
| 🔴 | `PUT` | `/write-off/${id2}/add-product` | `addProductWriteOff` |
| 🔴 | `PUT` | `/write-off/${id2}/finish` | `finishWriteOff` |
| 🔴 | `DELETE` | `/write-off/${writeOffId}/product/${productId}` | `deleteWriteOffProduct` |

### `writeoff_template` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🟢 | `POST` | `/writeoff_template` | `writeOffExport` |

### `{id}` (1)

| | Metod | Yo'l | Frontend funksiyasi |
|---|---|---|---|
| 🔴 | `POST` | `/${url}` | `updateMxik` |
