# 2. Data Ownership Model

## 3.1 Introduction
Every business entity has exactly one authoritative owner module responsible for its structure, validation, and lifecycle.

## 3.2 Single Ownership Principle
Only the owning module may modify its tables. Consuming modules access data via published APIs or read-only references.

## 3.3 Module Responsibilities
Owners handle:
- Schema migrations
- Business validation
- API exposure
- Data documentation

## 3.16 Data Ownership Matrix
| Business Entity Category | Owning Module | Typical Consumers |
| :--- | :--- | :--- |
| **Organization/Branch** | Platform Core | All Modules |
| **User/Role/Permission** | Identity (IAM) | All Modules |
| **Customer** | Partner Mgmt | Sales, Accounts |
| **Supplier** | Partner Mgmt | Purchase, Accounts |
| **Item/Warehouse** | Inventory | Sales, Purchase, MFG |
| **Sales Invoice** | Sales | Accounts, Reporting |
| **Journal Entry** | Finance | Reporting |
| **Employee** | HR | Payroll, Projects |

## 3.17 Ownership Violations
- Updating another module's tables directly.
- Duplicating master data across modules.
- Circumventing published APIs for write operations.
