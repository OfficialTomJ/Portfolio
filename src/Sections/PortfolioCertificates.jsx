import Image from 'next/image';
import UTS from "../../public/utslogo.png";

export default function PortfolioCertificates() {
    return (
        <section className="pt-12 pb-12 mb-12 lg:mb-24">
            <h2 className="pb-6">Certificates</h2>
            <div className="flex flex-col sm:flex-row gap-8 items-start">
                <Image alt="UTS Logo" src={UTS} className="h-16 lg:h-20 w-auto" />
                <div className="text-white">
                    <h3 className="text-xl font-semibold">Bachelor of Science in Information Technology @ UTS</h3>
                    <p className="mt-2"><strong>Course Code:</strong> C10148v4</p>
                    <p className="mt-2"><strong>Major:</strong> Enterprise Systems</p>
                    <p><strong>Minors:</strong> Cybersecurity, Data Analytics</p>
                    <p className="mt-2"><strong>GPA:</strong> 6.25 &nbsp;|&nbsp; <strong>WAM:</strong> 82.08</p>
                </div>
            </div>
        </section>
    )
}
