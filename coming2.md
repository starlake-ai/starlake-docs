# The Story behind Starlake:  Bringing Declarative Programming to Data Engineering and Analytics 

## Introduction:
The advent of declarative programming, 
exemplified by tools like Ansible and Terraform, 
has revolutionized infrastructure deployment by allowing developers 
to articulate intended goals without specifying the order of code execution. 
This paradigm shift brings forth benefits such as reduced error rates, 
significantly shortened development cycles, enhanced code readability, and increased accessibility for developers of all levels.

This is the story of how a small team of developers crafted a platform 
that went beyond the boundaries of conventional data engineering 
by applying a declarative approach to data loading and transformation.



## The Genesis

Back in 2015, at the helm of ebiznext, a boutique data engineering firm, we faced a daunting challenge. 
Our client, a prominent entity in need of a robust big data solution, sought to harness the power of Hadoop and Spark. 
Despite our modest size, we dared to compete against industry giants with tenfold resources.

Our only chance to succeed was to innovate: we needed a data platform that would outpace the competition exponentially. 
Traditional solutions relied on cumbersome ETL tools, elongating the data pipeline construction in proportion to source complexity.

Determined to disrupt this norm, a cadre of data enthusiasts and I 
embarked on a quest to devise a platform capable of lightning-fast data ingestion from any source, 
without the drawbacks of ETL tools or specialized engineering skills.


The day of the tender, 
our ability to deliver a solution that could load data in a few weeks instead of many months 
allowed us to stand out from the competition and win the project.

## Expisode 1: Smartlake Emerges:

Our breakthrough lay in embracing the declarative approach. 
Empowering business users, we devised a system where data formats and transformations could be described in simple JSON files. 
Smartlake wasn't merely a code generator;  it epitomized a versatile engine, seamlessly ingesting diverse data formats, executing transformations, and orchestrating operations with unparalleled efficiency.
To streamline user interaction, we devised an intuitive Excel-to-JSON converter, enabling effortless specification of input formats. 

Thanks to Smartlake and its declarative approach, the business users were able to define load and transformation operations with ease.
we could load data from almost any source, apply transformations on the fly, and store results in almost any target. 


## Expisode 2: Evolution to Starlake:
As the data landscape evolved, so did our vision. 
Cloud data warehouses emerged as formidable competitors to Spark for query execution. 
Recognizing this shift, we evolved Smartlake into Starlake, preserving its declarative essence while embracing YAML for enhanced readability.
We maintained Spark's prowess for data ingestion, 
leveraging cloud data warehouses for query execution. 
This strategic blend allowed us to optimize performance and cost-effectiveness based on specific workload requirements. 
The result was a reimagined platform, tailored for the cloud era, 
yet grounded in the principles of efficiency and simplicity that defined its inception.

The result is the Starlake OSS project that you can find on [Github](https://github.com/starlake-ai/starlake).

The capabilities of Starlake are extensively described [here](https://starlake-ai.github.io/starlake/docs/next/intro).

### The people behind Starlake
Smartlake, the precursor to Starlake, 
owes its existence to the collective efforts of numerous individuals, 
but a select few stand out for their exceptional contributions:

- Sam Bessalah: With Sam's presence, rallying others became effortless. His visionary outlook and knack for simplifying complexities proved transformative, setting a new standard for implementation.
- Olivier Girardot: Every team has its coding wizard, and Olivier filled that role impeccably. From leveraging Spark codegen to exploring mathematical frameworks like Matriyshoshka, he pushed the boundaries, mentoring the team with his expertise spanning Docker, Ansible, Python, Scala, and deep Spark functionalities.
- Valentin Kasas: The epitome of versatility, Valentin championed functional programming in Scala. Introducing concepts like monads, he empowered the team to craft code that was not just functional but also elegant and maintainable.

As the journey progressed, a myriad of other individuals joined the ranks, each leaving an indelible mark on the Starlake platform:

- Stéphane Manciot: The developer behind Starlake's declarative workflows on Airflow and Dagster, Stéphane's expertise was pivotal in shaping its operational backbone.
- Bounkong Khamphousone: The speed and efficiency of Starlake's extraction and load engines owe much to his contributions.
- Cyrille Chepelov: A master of codebase optimization, Cyrille's rewrite efforts were instrumental in ensuring the reentrant nature of Starlake's API.
- Abdelhamide Elarib: An early contributor to the load engine, this foresight and execution prowess played a significant role in shaping the platform's today capabilities.
- Mohamad Kassir: His direct contact with customer projects and his in-depth knowledge of cloud platforms and business needs have been major assets in the evolution of Starlake.
- Mourad Dachraoui: Adept at navigating the intricacies of Spark, Mourad's contributions to the platform's core functionalities were invaluable.

Together, these individuals formed the backbone of Starlake, embodying a spirit of innovation and collaboration that continues to propel its evolution.

Today with more than 200TB of data loaded into thousands of tables in various datalake and datawarehouses, we can confidently say that Starlake is battle tested and ready for the most demanding data engineering & analytics challenges.







