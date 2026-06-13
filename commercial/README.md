# Commercial Solutions - Data Tools Landscape

> **Objective:** Identify and classify the market's commercial/proprietary solutions for building a data platform.

---

## Overview

![Commercial Data Tools Landscape](commercial_infrastructure.svg)

---

## Directory Structure

This directory follows the **same organization** as the open-source solutions, adapted to commercial tools:

| File | Description | OSS Equivalent |
|---------|-------------|----------------|
| [01.ingestion_and_transport.md](01.ingestion_and_transport.md) | Commercial ETL/ELT, Streaming, CDC | 01.ingestion_and_transport.md |
| [02.storage.md](02.storage.md) | Cloud DW, Lakehouse, Object Storage | 02.storage.md |
| [03.query_and_processing.md](03.query_and_processing.md) | Query engines, Stream/Batch processing | 03.query_and_processing.md |
| [04.analysis_and_output.md](04.analysis_and_output.md) | BI, Dashboards, Web Analytics | 04.analysis_and_output.md |
| [05.platform_management.md](05.platform_management.md) | Orchestration, Governance, Quality | 05.platform_management.md |
| [06.classification_par_flux.md](06.classification_par_flux.md) | Streaming/Micro/Batch Classification | 06.classification_par_flux.md |
| [07.matrice_flux_fonction.md](07.matrice_flux_fonction.md) | Flow × Function Matrix | 07.matrice_flux_fonction.md |
| [08.visualisations_classification.md](08.visualisations_classification.md) | Diagrams and visualizations | 08.visualisations_classification.md |

---

## Thematic Organization

### By Functional Category

Each file follows the **same structure** as its open-source equivalent:

#### 01. Ingestion & Transport
- **Data Replication**: Fivetran, Stitch, Matillion, Informatica...
- **Event/Stream Processing**: Confluent, Kinesis, Event Hubs, Pub/Sub...
- **Log Collection**: Splunk, Datadog, Elastic Cloud, Cribl...
- **Change Data Capture**: Striim, Arcion, Qlik Replicate, AWS DMS...

#### 02. Storage
- **File Layer**: S3, Azure Blob, GCS, Wasabi, Cloudflare R2...
- **Object Storage**: NetApp, Dell ECS, Pure Storage...
- **Metadata Layer**: Snowflake, BigQuery, Databricks, Redshift...
- **Data Modeling**: dbt Cloud, Coalesce, Dataform, Prophecy...

#### 03. Query & Processing
- **Query Engine**: Starburst, Dremio, Athena, Firebolt...
- **Stream Processing**: Confluent ksqlDB, Decodable, Materialize...
- **Batch Processing**: Databricks, AWS Glue, dbt Cloud...
- **Dataframe Processing**: Hex, Deepnote, Mode, Databricks Notebooks...
- **Datawarehouse & OLAP**: Snowflake, BigQuery, ClickHouse Cloud...

#### 04. Analysis & Output
- **Framework**: Plotly Enterprise, Highcharts, Sisense.js...
- **High-Code**: Hex, Databricks Notebooks, Mode...
- **Low-Code**: Grafana Cloud, Datadog, Elastic Cloud...
- **No-Code**: Tableau, Power BI, Looker, Qlik...
- **Web Analytics**: Amplitude, Mixpanel, Heap, Segment...

#### 05. Platform Management
- **Data Quality & Testing**: Monte Carlo, Bigeye, Soda Cloud...
- **Governance**: Alation, Collibra, Atlan, Unity Catalog...
- **Automation**: Workato, Zapier, Power Automate...
- **Green IT**: AWS/Azure/GCP Carbon Tools, Watershed...
- **Workflow Manager**: Astronomer, Dagster Cloud, Prefect Cloud...
- **Compliance & Security**: Immuta, Privacera, BigID...

---

## Classifications

### By Data Flow (06)

| Mode | Latency | Commercial Leaders |
|------|---------|---------------------|
| Streaming | < 1s | Confluent, Kinesis, Striim |
| Micro-Batch | 1s-5min | Databricks, Snowflake, Fivetran |
| Batching | > 5min | Fivetran, dbt Cloud, Snowflake |

### Flow × Function Matrix (07)

Two-dimensional view combining:
- **Temporal axis**: Streaming, Micro-Batching, Batching
- **Functional axis**: Collection, Transport, Storage, Processing, Analysis, Governance

### Visualizations (08)

Mermaid diagrams for:
- Modern Data Stack Enterprise
- Real-time Analytics Stack
- Databricks Lakehouse Architecture

---

## Open Source → Commercial Mapping

| Category | Open Source | Commercial |
|-----------|-------------|------------|
| ETL/ELT | Airbyte | Fivetran |
| CDC | Debezium | Striim, Arcion |
| Streaming | Apache Kafka | Confluent Cloud |
| Storage | MinIO + Iceberg | Snowflake, Databricks |
| Processing | Apache Spark | Databricks |
| Transform | dbt core | dbt Cloud |
| Query | Trino | Starburst Galaxy |
| BI | Apache Superset | Tableau, Looker |
| Monitoring | Grafana | Grafana Cloud |
| Catalog | DataHub | Atlan, Alation |
| Quality | Great Expectations | Monte Carlo |
| Orchestration | Apache Airflow | Astronomer |

---

## Budget Estimate

| Size | Annual Budget | Stack Type |
|--------|---------------|------------|
| Startup (< 50 emp) | ~$30K | Fivetran → Snowflake → dbt → Preset |
| Scale-up (50-200) | ~$220K | + Looker + Monte Carlo + Atlan |
| Enterprise (200+) | ~$1.2M | + Tableau + Collibra + Full observability |

---

## References

- [Open Source Solutions](../README.md)
- [OSS Infrastructure Diagram](../data_infrastructure.svg)

---

**Document created on:** 2025-12-15
**Last updated:** 2025-12-15
**Version:** 2.0
