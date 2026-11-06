#!/usr/bin/env python3
"""Fetch Maven dependencies with curl into a local-repository layout.

Why this exists: Maven's own HTTP client cannot download from Maven
Central in this VM (Connection reset via the egress proxy), but curl can.
This script reimplements the small part of Maven resolution we need:
read the prototype pom, walk parent poms + the Spring Boot BOM, collect
the transitive dependency closure, and download every .pom and .jar into
a local-repository layout. The result lets us compile with plain javac
and run the Spring Boot app with plain java — no Maven network access.

Usage:
    python3 fetch-deps.py [--pom PATH] [--repo DIR] [--extra g:a:v ...]
Defaults: pom = ../pom.xml (relative to this script), repo =
/tmp/gradebook-m2/repository. Extra artifacts (e.g. H2 for the local
run, junit-platform-console-standalone for tests) are resolved too.

Outputs:
    <repo>/...                        jars + poms in Maven layout
    <repo>/../classpath.txt           absolute jar paths, one per line
    <repo>/../resolved.txt            resolved g:a:v list (for auditing)

Exit 0 on success. Any artifact that cannot be fetched aborts the run.
"""

import argparse
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import deque

BASE = "https://repo.maven.apache.org/maven2"

# Scopes we need on the compile+run+test classpath. "provided" is skipped
# (its classes come from the runtime container, e.g. embedded Tomcat).
WANTED_SCOPES = {"compile", "runtime", "test", None, ""}
# Maven rule: test-scoped dependencies are NOT transitive. A library's own
# test deps (e.g. awaitility's test-support, which was never published at
# that version) must not be pulled into our tree. Only the root pom's
# direct test deps are included.
TRANSITIVE_SCOPES = {"compile", "runtime", None, ""}


def log(msg):
    print(f"[fetch-deps] {msg}", flush=True)


def curl(url, dest):
    """Download url to dest with curl. Returns True on success."""
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".tmp"
    r = subprocess.run(
        ["curl", "-sfL", "--retry", "2", "--max-time", "120", "-o", tmp, url],
        capture_output=True, text=True)
    if r.returncode != 0:
        if os.path.exists(tmp):
            os.remove(tmp)
        return False
    os.replace(tmp, dest)
    return True


def group_path(group):
    return group.replace(".", "/")


def pom_rel(group, artifact, version):
    return f"{group_path(group)}/{artifact}/{version}/{artifact}-{version}.pom"


def jar_rel(group, artifact, version):
    return f"{group_path(group)}/{artifact}/{version}/{artifact}-{version}.jar"


def strip_ns(tag):
    return tag.split("}", 1)[-1] if "}" in tag else tag


def children(el, name):
    return [c for c in el if strip_ns(c.tag) == name]


def child(el, name):
    for c in el:
        if strip_ns(c.tag) == name:
            return c
    return None


def text(el, name):
    c = child(el, name)
    return c.text.strip() if c is not None and c.text else None


def parse_pom(path):
    return ET.parse(path).getroot()


def resolve_props(value, props):
    """Expand ${...} using props (up to 10 passes). Unknown keys stay as-is."""
    if value is None:
        return None
    for _ in range(10):
        new = re.sub(r"\$\{([^}]+)\}",
                     lambda m: props.get(m.group(1), m.group(0)), value)
        if new == value:
            return new
        value = new
    return value


class PomChain:
    """A pom plus its parent chain (topmost parent first)."""

    def __init__(self, pom_path):
        self.poms = []  # list of (root, path), topmost parent first
        self._load(pom_path, set())

    def _load(self, pom_path, seen):
        root = parse_pom(pom_path)
        parent = child(root, "parent")
        if parent is not None:
            pg = text(parent, "groupId")
            pa = text(parent, "artifactId")
            pv = text(parent, "version")
            key = (pg, pa, pv)
            if key not in seen:
                seen.add(key)
                parent_path = fetch_pom(pg, pa, pv)
                if parent_path:
                    self._load(parent_path, seen)
        self.poms.append((root, pom_path))

    def properties(self):
        """Merged <properties>: child overrides parent. project.groupId /
        project.artifactId / project.version are inherited from the parent
        chain when the leaf pom does not declare them (Maven semantics)."""
        props = {}
        for root, _ in self.poms:
            p = child(root, "properties")
            if p is not None:
                for c in p:
                    if c.text:
                        props[strip_ns(c.tag)] = c.text.strip()
        # Effective coordinates: first declaration walking leaf -> parents.
        for key in ("groupId", "artifactId", "version"):
            for root, _ in reversed(self.poms):
                v = text(root, key)
                if v:
                    props.setdefault(f"project.{key}", v)
                    break
            props.setdefault(f"project.{key}", "")
        return props

    def imported_bom_properties(self):
        """Properties defined by BOMs imported in this chain's
        dependencyManagement (e.g. jackson-bom defines
        jackson.version.databind). Management entries from those BOMs
        reference these properties, so they must be visible when versions
        are resolved. The chain's own properties win over BOM properties."""
        props = {}
        for root, _ in self.poms:
            dm = child(root, "dependencyManagement")
            if dm is None:
                continue
            deps = child(dm, "dependencies")
            if deps is None:
                continue
            for d in children(deps, "dependency"):
                if text(d, "scope") == "import" and text(d, "type") == "pom":
                    g, a, v = text(d, "groupId"), text(d, "artifactId"), text(d, "version")
                    if not (g and a and v):
                        continue
                    vv = resolve_props(v, self.properties())
                    bom_path = fetch_pom(g, a, vv)
                    if bom_path:
                        bom = PomChain(bom_path)
                        for k, val in bom.effective_properties().items():
                            props.setdefault(k, val)
        return props

    def effective_properties(self):
        """Chain properties + imported-BOM properties (chain wins)."""
        return {**self.imported_bom_properties(), **self.properties()}

    def management(self):
        """Merged <dependencyManagement> entries: (group, artifact) -> version
        (raw, may contain ${...}). Child overrides parent; imported BOMs
        are merged in place, after the importing pom's own entries."""
        mgmt = {}
        chain_props = self.effective_properties()
        for root, _ in self.poms:
            dm = child(root, "dependencyManagement")
            if dm is None:
                continue
            deps = child(dm, "dependencies")
            if deps is None:
                continue
            for d in children(deps, "dependency"):
                # Group/artifact ids may themselves be placeholders
                # (e.g. ${project.groupId} in hibernate-validator-parent).
                g = resolve_props(text(d, "groupId"), chain_props)
                a = resolve_props(text(d, "artifactId"), chain_props)
                v = text(d, "version")
                scope = text(d, "scope")
                dtype = text(d, "type")
                if scope == "import" and dtype == "pom" and g and a and v:
                    vv = resolve_props(v, chain_props)
                    bom_path = fetch_pom(g, a, vv)
                    if bom_path:
                        bom = PomChain(bom_path)
                        # The BOM's management() resolves its entries eagerly
                        # against the BOM's own properties.
                        for k, val in bom.management().items():
                            mgmt.setdefault(k, val)
                    continue
                if g and a and v:
                    # Resolve eagerly against THIS chain's properties:
                    # a ${project.version} in a BOM entry means the BOM's
                    # version, not the consuming artifact's.
                    mgmt[(g, a)] = resolve_props(v, chain_props)
        return mgmt


# Set by main() before any PomChain is built.
REPO = "/tmp/gradebook-m2/repository"
POM_CACHE = "/tmp/gradebook-m2/pom-cache"


def fetch_pom(group, artifact, version):
    """Return the local path of a pom, downloading it if needed."""
    rel = pom_rel(group, artifact, version)
    dest = os.path.join(POM_CACHE, rel)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    url = f"{BASE}/{rel}"
    if curl(url, dest):
        return dest
    return None


def pom_dependencies(root, props=None):
    """Direct <dependencies> of a pom: list of dicts. Group/artifact ids
    may contain ${...} placeholders (e.g. ${project.groupId}); they are
    expanded with the declaring pom's chain properties when given."""
    props = props or {}
    out = []
    deps = child(root, "dependencies")
    if deps is None:
        return out
    for d in children(deps, "dependency"):
        g = resolve_props(text(d, "groupId"), props)
        a = resolve_props(text(d, "artifactId"), props)
        v = text(d, "version")
        scope = text(d, "scope")
        dtype = text(d, "type") or "jar"
        optional = text(d, "optional") == "true"
        exclusions = set()
        ex = child(d, "exclusions")
        if ex is not None:
            for e in children(ex, "exclusion"):
                eg = text(e, "groupId")
                ea = text(e, "artifactId")
                if eg and ea:
                    exclusions.add((eg, ea))
        if g and a:
            out.append({"group": g, "artifact": a, "version": v, "scope": scope,
                        "type": dtype, "optional": optional,
                        "exclusions": exclusions})
    return out


def resolve_closure(start_pom, extra_artifacts):
    """BFS over the dependency tree. Returns {(g, a): version}."""
    root_chain = PomChain(start_pom)
    root_props = root_chain.effective_properties()
    root_mgmt = root_chain.management()
    log(f"root management entries: {len(root_mgmt)}")

    resolved = {}
    queue = deque()

    def enqueue(g, a, v, exclusions):
        key = (g, a)
        if key in resolved:
            return
        resolved[key] = v
        queue.append((g, a, v, exclusions))

    # Direct dependencies of the prototype pom.
    leaf = root_chain.poms[-1][0]
    for d in pom_dependencies(leaf, root_props):
        if d["optional"] or d["scope"] not in WANTED_SCOPES:
            continue
        v = d["version"]
        if v is None:
            raw = root_mgmt.get((d["group"], d["artifact"]))
            v = resolve_props(raw, root_props) if raw else None
        if v is None:
            raise SystemExit(f"cannot resolve version for {d['group']}:{d['artifact']}")
        v = resolve_props(v, root_props)
        enqueue(d["group"], d["artifact"], v, frozenset(d["exclusions"]))

    for spec in extra_artifacts:
        g, a, v = spec.split(":")
        enqueue(g, a, v, frozenset())

    while queue:
        g, a, v, exclusions = queue.popleft()
        pom_path = fetch_pom(g, a, v)
        if pom_path is None:
            raise SystemExit(f"cannot fetch pom for {g}:{a}:{v}")
        chain = PomChain(pom_path)
        props = chain.effective_properties()
        mgmt = chain.management()
        for d in pom_dependencies(chain.poms[-1][0], props):
            if d["optional"] or d["scope"] not in TRANSITIVE_SCOPES:
                continue
            if (d["group"], d["artifact"]) in exclusions:
                continue
            if (d["group"], d["artifact"]) in resolved:
                continue
            ver = d["version"]
            if ver is None:
                raw = root_mgmt.get((d["group"], d["artifact"]))
                if raw is None:
                    raw = mgmt.get((d["group"], d["artifact"]))
                # The declaring artifact's own properties win over the
                # root project's (e.g. ${project.version} is the artifact's
                # version, not the prototype's).
                ver = resolve_props(raw, {**root_props, **props}) if raw else None
            if ver is None:
                raise SystemExit(
                    f"cannot resolve version for {d['group']}:{d['artifact']} "
                    f"(needed by {g}:{a}:{v})")
            ver = resolve_props(ver, {**root_props, **props})
            enqueue(d["group"], d["artifact"], ver,
                    frozenset(d["exclusions"]) | exclusions)
    return resolved


def download_all(resolved):
    """Download every pom + jar into the repo layout. Returns jar paths."""
    jars = []
    for (g, a), v in sorted(resolved.items()):
        prel = pom_rel(g, a, v)
        pdest = os.path.join(REPO, prel)
        if not curl(f"{BASE}/{prel}", pdest):
            raise SystemExit(f"cannot fetch pom {g}:{a}:{v}")
        # Packaging decides whether a jar exists.
        try:
            packaging = text(parse_pom(pdest), "packaging") or "jar"
        except ET.ParseError:
            packaging = "jar"
        if packaging == "pom":
            continue
        jrel = jar_rel(g, a, v)
        jdest = os.path.join(REPO, jrel)
        if not curl(f"{BASE}/{jrel}", jdest):
            raise SystemExit(f"cannot fetch jar {g}:{a}:{v}")
        jars.append(jdest)
    return jars


def main():
    global REPO, POM_CACHE
    ap = argparse.ArgumentParser()
    ap.add_argument("--pom", default=None)
    ap.add_argument("--repo", default="/tmp/gradebook-m2/repository")
    ap.add_argument("--extra", nargs="*", default=[])
    args = ap.parse_args()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pom = args.pom or os.path.join(script_dir, "..", "pom.xml")
    pom = os.path.abspath(pom)
    REPO = os.path.abspath(args.repo)
    POM_CACHE = os.path.join(os.path.dirname(REPO), "pom-cache")
    os.makedirs(REPO, exist_ok=True)

    log(f"pom: {pom}")
    log(f"repo: {REPO}")
    resolved = resolve_closure(pom, args.extra)
    log(f"resolved {len(resolved)} artifacts")
    jars = download_all(resolved)
    log(f"downloaded {len(jars)} jars")

    out_dir = os.path.dirname(REPO)
    with open(os.path.join(out_dir, "resolved.txt"), "w") as f:
        for (g, a), v in sorted(resolved.items()):
            f.write(f"{g}:{a}:{v}\n")
    with open(os.path.join(out_dir, "classpath.txt"), "w") as f:
        for j in jars:
            f.write(j + "\n")
    log(f"wrote {out_dir}/classpath.txt ({len(jars)} jars)")
    log("done")


if __name__ == "__main__":
    main()
