import yaml
import sys

try:
    with open('.github/workflows/ci.yml', 'r') as f:
        yaml.safe_load(f)
    print("YAML is valid")
except yaml.YAMLError as exc:
    print(exc)
    sys.exit(1)
