from setuptools import setup, find_packages

setup(
    name="orbitalmind-ml-core",
    version="1.0.0",
    description="ML models for OrbitalMind constellation management",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.10",
    install_requires=[
        "torch==2.1.1",
        "numpy==1.26.2",
        "pandas==2.1.3",
        "scikit-learn>=1.3.0",
        "psycopg2-binary==2.9.9",
        "pydantic==2.5.0",
        "pydantic-settings==2.1.0",
    ],
    extras_require={
        "gpu": ["torch[cuda]>=2.1.1"],
        "dev": ["pytest>=7.4.0", "pytest-cov>=4.1.0"],
    },
)
