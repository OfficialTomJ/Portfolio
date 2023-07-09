import React from "react";
import fs from "fs/promises";
import path from "path";
import grayMatter from "gray-matter";
import ReactMarkdown from "react-markdown";
import '../../app/globals.css';
import Footer from '../../Sections/PortfolioFooter';
import { PiArrowLeftThin } from "react-icons/pi";
import Link from "next/link";
import Navbar from '../../Components/PortfolioNavbar';

const BlogPost = ({ frontmatter, content }) => {
  const paragraphs = content.split("\n\n");

  return (
    <>
      <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
        <div className="container max-w-5xl">
          <Navbar/>
          <Link href="/">
            <div className="flex items-center justify-start mt-4 lg:mt-16 cursor-pointer">
              <PiArrowLeftThin className="text-4xl mr-2 lg:text-5xl" />
            </div>
          </Link>
          <h1 className="text-5xl mt-4 lg:mt-8 mb-2">
            <Link href="#">
              {frontmatter.title}
            </Link>
          </h1>
          <p className="">
            <Link href="#">
              {frontmatter.date}
            </Link>
          </p>
          <div className="mt-4 lg:mt-8 aspect-w-1 aspect-h-1 h-full max-h-[280px] lg:max-h-[360px] overflow-hidden rounded-2xl">
            <img src={frontmatter.image} alt="Blog Image" className="object-cover w-full h-full" />
          </div>

          <div className="sm:max-w-[60%] leading-7 mt-4 lg:mt-8">
            {paragraphs.map((paragraph, index) => {
              return (
                <div key={index} className="mb-4 lg:mb-8">
                  <ReactMarkdown
                    components={{
                      ul: ({ node, ...props }) => (
                        <ul style={{ listStyle: "disc" }} {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li style={{ marginLeft: "1.5rem" }} {...props} />
                      ),
                      a: ({ node, ...props }) => (
                        <a className="underline" target="_none" {...props} />
                      ),
                    }}
                  >
                    {paragraph}
                  </ReactMarkdown>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer></Footer>
    </>
  );
};

export async function getStaticPaths() {
  const postsDirectory = path.join(process.cwd(), "src", "posts");
  const filenames = await fs.readdir(postsDirectory);
  const paths = filenames.map((filename) => ({
    params: { slug: filename.replace(/\.md$/, "") },
  }));

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const { slug } = params;
  const filePath = path.join(process.cwd(), "src", "posts", `${slug}.md`);
  const fileContents = await fs.readFile(filePath, "utf8");
  const { data, content } = grayMatter(fileContents);

  return {
    props: {
      frontmatter: {
        ...data,
        date: data.date.toString(),
      },
      content,
    },
  };
}

export default BlogPost;
